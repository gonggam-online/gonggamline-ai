import {
  GetObjectRetentionCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { Context, Handler } from "aws-lambda";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";

import {
  type ArchiveSource,
  type BackupClass,
  type BackupInvocation,
  BackupWorkerError,
  type ImmutableObjectWriter,
  type PutObjectRequest,
  type PutObjectResult,
  type RetentionResult,
  invocationObjectPrefix,
  runBackupWorker,
} from "./pipeline";

const execFileAsync = promisify(execFile);
const safeNamePattern = /^[A-Za-z0-9_.-]+$/;
const hostPattern = /^[A-Za-z0-9.-]+$/;

type DatabaseSecret = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslmode: "require";
};

type WorkerEnvironment = Readonly<{
  bucketName: string;
  kmsKeyArn: string;
  databaseSecretArn: string;
  sourceProjectRef: string;
  sourceRegion: "ap-southeast-1";
  dailyRetentionDays: number;
  monthlyRetentionDays: number;
}>;

type ScheduledEvent = Readonly<{ mode: "scheduled"; version: 1 }>;
type ManualEvent = Readonly<{
  mode: "manual";
  version: 1;
  requestId: string;
  backupClass: BackupClass;
  scheduledAt: string;
}>;
type WorkerEvent = ScheduledEvent | ManualEvent;

export function classifyExistingKeys(keys: readonly string[]): "EMPTY" | "COMPLETE" | "PARTIAL" {
  if (keys.length === 0) return "EMPTY";
  const archives = keys.filter((key) => key.endsWith(".dump"));
  const manifests = keys.filter((key) => key.endsWith(".manifest.json"));
  return archives.length === 1 && manifests.length === 1 && keys.length === 2
    ? "COMPLETE"
    : "PARTIAL";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new BackupWorkerError("INVALID_INVOCATION");
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  return value;
}

export function loadEnvironment(): WorkerEnvironment {
  const sourceRegion = required("SOURCE_REGION");
  if (sourceRegion !== "ap-southeast-1") {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  return Object.freeze({
    bucketName: required("BACKUP_BUCKET_NAME"),
    kmsKeyArn: required("BACKUP_KMS_KEY_ARN"),
    databaseSecretArn: required("PRODUCTION_DATABASE_SECRET_ARN"),
    sourceProjectRef: required("SOURCE_PROJECT_REF"),
    sourceRegion,
    dailyRetentionDays: positiveInteger("DAILY_RETENTION_DAYS"),
    monthlyRetentionDays: positiveInteger("MONTHLY_RETENTION_DAYS"),
  });
}

export function parseDatabaseSecret(secretString: string): DatabaseSecret {
  let value: unknown;
  try {
    value = JSON.parse(secretString);
  } catch {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  const candidate = value as Record<string, unknown>;
  const host = candidate.host;
  const port = candidate.port;
  const database = candidate.database;
  const username = candidate.username;
  const password = candidate.password;
  const sslmode = candidate.sslmode;
  if (
    typeof host !== "string" || !hostPattern.test(host) ||
    typeof port !== "number" || !Number.isSafeInteger(port) || port < 1 || port > 65535 ||
    typeof database !== "string" || !safeNamePattern.test(database) ||
    typeof username !== "string" || !safeNamePattern.test(username) ||
    typeof password !== "string" || password.length < 8 ||
    sslmode !== "require"
  ) {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  return { host, port, database, username, password, sslmode };
}

function singaporeDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function resolveInvocation(
  event: WorkerEvent,
  sourceProjectRef: string,
  now: Date,
): BackupInvocation {
  if (event.mode === "manual") {
    return Object.freeze({
      requestId: event.requestId,
      backupClass: event.backupClass,
      scheduledAt: event.scheduledAt,
      sourceProjectRef,
      sourceRegion: "ap-southeast-1",
    });
  }
  if (event.mode !== "scheduled" || event.version !== 1) {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  const date = singaporeDate(now);
  const backupClass: BackupClass = date.endsWith("-01") ? "monthly" : "daily";
  return Object.freeze({
    requestId: `scheduled-${date}`,
    backupClass,
    scheduledAt: now.toISOString(),
    sourceProjectRef,
    sourceRegion: "ap-southeast-1",
  });
}

class PostgresArchiveSource implements ArchiveSource {
  constructor(private secret: DatabaseSecret) {}

  private async run(program: "pg_dump" | "pg_restore", args: readonly string[]) {
    const started = performance.now();
    const result = await execFileAsync(program, [...args], {
      encoding: "utf8",
      timeout: 780_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        PGPASSWORD: this.secret.password,
        PGCONNECT_TIMEOUT: "15",
        PGSSLMODE: this.secret.sslmode,
      },
    });
    const stderr = result.stderr ?? "";
    return Object.freeze({
      stdout: result.stdout ?? "",
      warningCount: stderr.split(/\r?\n/).filter((line) => /warning/i.test(line)).length,
      durationMs: Math.round(performance.now() - started),
    });
  }

  async create(destinationPath: string) {
    return this.run("pg_dump", [
      "--host", this.secret.host,
      "--port", String(this.secret.port),
      "--username", this.secret.username,
      "--dbname", this.secret.database,
      "--format", "custom",
      "--no-password",
      "--file", destinationPath,
    ]);
  }

  async inspect(archivePath: string) {
    const result = await this.run("pg_restore", ["--list", archivePath]);
    return Object.freeze({
      entryCount: result.stdout.split(/\r?\n/).filter((line) => /^\d+;/.test(line)).length,
      warningCount: result.warningCount,
      durationMs: result.durationMs,
    });
  }

  async dispose(): Promise<void> {
    this.secret.password = "";
  }
}

class S3ImmutableObjectWriter implements ImmutableObjectWriter {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  async putIfAbsent(request: PutObjectRequest): Promise<PutObjectResult> {
    try {
      const response = await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: request.key,
        Body: createReadStream(request.filePath),
        ContentLength: request.contentLength,
        ChecksumSHA256: request.checksumSha256Base64,
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: request.kmsKeyArn,
        ObjectLockMode: "GOVERNANCE",
        ObjectLockRetainUntilDate: new Date(request.retainUntil),
        Metadata: request.metadata,
        IfNoneMatch: "*",
      }));
      if (
        !response.VersionId ||
        response.ChecksumSHA256 !== request.checksumSha256Base64 ||
        response.ServerSideEncryption !== "aws:kms" ||
        response.SSEKMSKeyId !== request.kmsKeyArn
      ) {
        throw new BackupWorkerError("UPLOAD_CONTRACT_FAILED");
      }
      return Object.freeze({
        disposition: "CREATED",
        versionId: response.VersionId,
        checksumSha256Base64: response.ChecksumSHA256,
        serverSideEncryption: "aws:kms",
        kmsKeyArn: request.kmsKeyArn,
      });
    } catch (error) {
      const preconditionFailed = error instanceof S3ServiceException &&
        (error.name === "PreconditionFailed" || error.$metadata.httpStatusCode === 412);
      if (!preconditionFailed) throw error;
      const objects = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: request.key,
        MaxKeys: 2,
      }));
      const exact = objects.Contents?.find((object) => object.Key === request.key);
      if (!exact) throw new BackupWorkerError("UPLOAD_CONTRACT_FAILED");
      return Object.freeze({
        disposition: "EXACT_REPLAY",
        versionId: "latest-existing",
        checksumSha256Base64: request.checksumSha256Base64,
        serverSideEncryption: "aws:kms",
        kmsKeyArn: request.kmsKeyArn,
      });
    }
  }

  async existingKeys(prefix: string): Promise<readonly string[]> {
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: `${prefix}/`,
      MaxKeys: 3,
    }));
    return Object.freeze((response.Contents ?? []).flatMap(({ Key }) => Key ? [Key] : []));
  }

  async getRetention(key: string, versionId: string): Promise<RetentionResult> {
    const response = await this.client.send(new GetObjectRetentionCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(versionId === "latest-existing" ? {} : { VersionId: versionId }),
    }));
    if (response.Retention?.Mode !== "GOVERNANCE" || !response.Retention.RetainUntilDate) {
      throw new BackupWorkerError("RETENTION_CONTRACT_FAILED");
    }
    return Object.freeze({
      mode: "GOVERNANCE",
      retainUntil: response.Retention.RetainUntilDate.toISOString(),
    });
  }
}

async function loadDatabaseSecret(client: SecretsManagerClient, arn: string): Promise<DatabaseSecret> {
  const response = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!response.SecretString) throw new BackupWorkerError("INVALID_INVOCATION");
  return parseDatabaseSecret(response.SecretString);
}

function sanitizedLog(event: Readonly<Record<string, string | number | boolean>>): void {
  console.log(JSON.stringify(event));
}

export const handler: Handler<WorkerEvent> = async (event, context: Context) => {
  const environment = loadEnvironment();
  const now = new Date();
  const invocation = resolveInvocation(event, environment.sourceProjectRef, now);
  const secretClient = new SecretsManagerClient({ region: environment.sourceRegion });
  const s3Client = new S3Client({ region: environment.sourceRegion });
  const objects = new S3ImmutableObjectWriter(s3Client, environment.bucketName);
  const prefix = invocationObjectPrefix(invocation);
  const existingKeys = await objects.existingKeys(prefix);
  const existingState = classifyExistingKeys(existingKeys);
  if (existingState === "PARTIAL") {
    throw new BackupWorkerError("UPLOAD_CONTRACT_FAILED");
  }
  if (existingState === "COMPLETE") {
    sanitizedLog({ event: "BACKUP_WORKER_EXACT_REPLAY", backupClass: invocation.backupClass });
    s3Client.destroy();
    secretClient.destroy();
    return Object.freeze({
      schemaVersion: "gonggamline-backup-worker-replay-v1",
      status: "EXACT_REPLAY",
      requestId: invocation.requestId,
      backupClass: invocation.backupClass,
    });
  }
  const secret = await loadDatabaseSecret(secretClient, environment.databaseSecretArn);
  const temporaryDirectory = `/tmp/gonggamline-backup-${context.awsRequestId}`;
  await mkdir(temporaryDirectory, { recursive: false });
  try {
    return await runBackupWorker(invocation, {
      source: new PostgresArchiveSource(secret),
      objects,
      temporaryDirectory,
      kmsKeyArn: environment.kmsKeyArn,
      limits: Object.freeze({
        deadlineEpochMs: Date.now() + context.getRemainingTimeInMillis(),
        cleanupReserveMs: 60_000,
        maximumEphemeralBytes: 10_240 * 1024 * 1024,
        dailyRetentionDays: environment.dailyRetentionDays,
        monthlyRetentionDays: environment.monthlyRetentionDays,
      }),
      log: sanitizedLog,
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
    s3Client.destroy();
    secretClient.destroy();
  }
};
