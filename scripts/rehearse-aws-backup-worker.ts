import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  type ArchiveSource,
  type ImmutableObjectWriter,
  type PutObjectRequest,
  type PutObjectResult,
  type RetentionResult,
  createExclusiveFile,
  runBackupWorker,
} from "../tools/aws-backup-worker/pipeline";

const postgresImage = "postgres@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929";
const stressArchiveBytes = 1_430_142;
const maximumRuntimeMs = 900_000;
const maximumEphemeralBytes = 10_240 * 1024 * 1024;
const syntheticKmsKeyArn = "arn:aws:kms:ap-southeast-1:000000000000:key/00000000-0000-0000-0000-000000000000";

type CommandResult = Readonly<{ stdout: string; stderr: string; durationMs: number }>;

function run(command: string, args: readonly string[], timeoutMs = 120_000): CommandResult {
  const started = performance.now();
  const result = spawnSync(command, [...args], {
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`SYNTHETIC_COMMAND_FAILED:${command}`);
  }
  return Object.freeze({
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    durationMs: Math.round(performance.now() - started),
  });
}

function sleep(milliseconds: number): void {
  const gate = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(gate, 0, 0, milliseconds);
}

function warningCount(stderr: string): number {
  return stderr.split(/\r?\n/).filter((line) => /warning/i.test(line)).length;
}

class DockerSyntheticArchiveSource implements ArchiveSource {
  private readonly token = randomBytes(6).toString("hex");
  private readonly databaseContainer = `gonggamline-worker-db-${this.token}`;
  private readonly dumpContainer = `gonggamline-worker-dump-${this.token}`;
  private readonly inspectContainer = `gonggamline-worker-inspect-${this.token}`;
  private readonly network = `gonggamline-worker-net-${this.token}`;
  private started = false;

  constructor(private readonly mountDirectory: string) {}

  async create(destinationPath: string) {
    run("docker", ["network", "create", "--internal", this.network]);
    run("docker", [
      "run", "--detach", "--name", this.databaseContainer,
      "--network", this.network,
      "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
      postgresImage,
    ], 300_000);
    this.started = true;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const probe = spawnSync("docker", ["exec", this.databaseContainer, "pg_isready", "-U", "postgres"], {
        encoding: "utf8",
        windowsHide: true,
      });
      if (probe.status === 0) {
        ready = true;
        break;
      }
      sleep(500);
    }
    if (!ready) throw new Error("SYNTHETIC_DATABASE_NOT_READY");
    run("docker", [
      "exec", this.databaseContainer,
      "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
      "-c",
      "CREATE TABLE rehearsal_rows AS SELECT i AS id, md5(i::text) AS a, md5((i::bigint * 7919)::text) AS b, repeat(md5((i::bigint * 104729)::text), 2) AS payload FROM generate_series(1, 100000) AS i; ALTER TABLE rehearsal_rows ADD PRIMARY KEY (id);",
    ], 300_000);
    const result = run("docker", [
      "run", "--rm", "--name", this.dumpContainer,
      "--network", `container:${this.databaseContainer}`,
      "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--mount", `type=bind,source=${this.mountDirectory},target=/work`,
      postgresImage,
      "pg_dump", "--host", "127.0.0.1", "--username", "postgres", "--dbname", "postgres",
      "--format", "custom", "--file", "/work/backup.dump",
    ], 900_000);
    if (path.resolve(destinationPath) !== path.join(path.resolve(this.mountDirectory), "backup.dump")) {
      throw new Error("SYNTHETIC_ARCHIVE_PATH_MISMATCH");
    }
    return Object.freeze({ durationMs: result.durationMs, warningCount: warningCount(result.stderr) });
  }

  async inspect(archivePath: string) {
    const started = performance.now();
    const result = run("docker", [
      "run", "--rm", "--name", this.inspectContainer,
      "--network", "none", "--read-only", "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--mount", `type=bind,source=${this.mountDirectory},target=/work,readonly`,
      postgresImage, "pg_restore", "--list", "/work/backup.dump",
    ], 300_000);
    const expected = path.join(path.resolve(this.mountDirectory), "backup.dump");
    if (path.resolve(archivePath) !== expected) throw new Error("SYNTHETIC_ARCHIVE_PATH_MISMATCH");
    const entryCount = result.stdout.split(/\r?\n/).filter((line) => /^\d+;/.test(line)).length;
    return Object.freeze({
      entryCount,
      warningCount: warningCount(result.stderr),
      durationMs: Math.round(performance.now() - started),
    });
  }

  async dispose(): Promise<void> {
    for (const container of [this.dumpContainer, this.inspectContainer]) {
      spawnSync("docker", ["rm", "--force", container], { windowsHide: true, encoding: "utf8" });
    }
    if (this.started) {
      spawnSync("docker", ["rm", "--force", this.databaseContainer], { windowsHide: true, encoding: "utf8" });
    }
    spawnSync("docker", ["network", "rm", this.network], { windowsHide: true, encoding: "utf8" });
  }
}

type StoredObject = Readonly<{
  request: PutObjectRequest;
  result: PutObjectResult;
  retention: RetentionResult;
}>;

class SyntheticImmutableObjectWriter implements ImmutableObjectWriter {
  private readonly objects = new Map<string, StoredObject>();

  constructor(private readonly root: string) {}

  async putIfAbsent(request: PutObjectRequest): Promise<PutObjectResult> {
    const prior = this.objects.get(request.key);
    if (prior) {
      if (
        prior.request.checksumSha256Base64 !== request.checksumSha256Base64 ||
        prior.request.contentLength !== request.contentLength ||
        prior.request.retainUntil !== request.retainUntil
      ) {
        throw new Error("SYNTHETIC_IMMUTABLE_CONFLICT");
      }
      return Object.freeze({ ...prior.result, disposition: "EXACT_REPLAY" });
    }
    const destination = path.join(this.root, ...request.key.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(request.filePath, destination);
    const digest = createHash("sha256").update(await readFile(destination)).digest("base64");
    const copied = await stat(destination);
    if (digest !== request.checksumSha256Base64 || copied.size !== request.contentLength) {
      throw new Error("SYNTHETIC_UPLOAD_CHECKSUM_MISMATCH");
    }
    const result: PutObjectResult = Object.freeze({
      disposition: "CREATED",
      versionId: `synthetic-${createHash("sha256").update(request.key).digest("hex").slice(0, 32)}`,
      checksumSha256Base64: request.checksumSha256Base64,
      serverSideEncryption: "aws:kms",
      kmsKeyArn: request.kmsKeyArn,
    });
    const retention: RetentionResult = Object.freeze({ mode: "GOVERNANCE", retainUntil: request.retainUntil });
    this.objects.set(request.key, Object.freeze({ request, result, retention }));
    return result;
  }

  async getRetention(key: string, versionId: string): Promise<RetentionResult> {
    const stored = this.objects.get(key);
    if (!stored || stored.result.versionId !== versionId) throw new Error("SYNTHETIC_RETENTION_NOT_FOUND");
    return stored.retention;
  }

  snapshot(): readonly StoredObject[] {
    return Object.freeze([...this.objects.values()]);
  }
}

async function main(): Promise<void> {
  const resultArgument = process.argv.find((argument) => argument.startsWith("--result="));
  if (!resultArgument) throw new Error("RESULT_PATH_REQUIRED");
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const resultPath = path.resolve(repositoryRoot, resultArgument.slice("--result=".length));
  const allowedResultRoot = path.join(repositoryRoot, ".local-state", "aws-backup-worker-rehearsal");
  if (path.dirname(resultPath) !== allowedResultRoot) throw new Error("RESULT_PATH_OUTSIDE_LOCAL_STATE");
  await mkdir(allowedResultRoot, { recursive: true });

  const temporaryRoot = await import("node:fs/promises").then(({ mkdtemp }) =>
    mkdtemp(path.join(os.tmpdir(), "gonggamline-worker-rehearsal-")));
  const workerTemporaryDirectory = path.join(temporaryRoot, "worker");
  const syntheticObjectDirectory = path.join(temporaryRoot, "synthetic-object-store");
  await mkdir(workerTemporaryDirectory, { recursive: true });
  await mkdir(syntheticObjectDirectory, { recursive: true });
  const source = new DockerSyntheticArchiveSource(workerTemporaryDirectory);
  const objects = new SyntheticImmutableObjectWriter(syntheticObjectDirectory);
  const started = performance.now();

  try {
    const worker = await runBackupWorker(
      {
        requestId: "synthetic-rehearsal-v1",
        backupClass: "daily",
        scheduledAt: "2026-08-06T00:00:00.000Z",
        sourceProjectRef: "synthetic-only",
        sourceRegion: "ap-southeast-1",
      },
      {
        source,
        objects,
        temporaryDirectory: workerTemporaryDirectory,
        kmsKeyArn: syntheticKmsKeyArn,
        limits: {
          deadlineEpochMs: Date.now() + maximumRuntimeMs,
          cleanupReserveMs: 60_000,
          maximumEphemeralBytes,
          dailyRetentionDays: 35,
          monthlyRetentionDays: 365,
        },
      },
    );
    const storedObjects = objects.snapshot();
    if (worker.archive.bytes < stressArchiveBytes) throw new Error("STRESS_ARCHIVE_SIZE_NOT_REACHED");
    if (storedObjects.length !== 2) throw new Error("ARCHIVE_AND_MANIFEST_REQUIRED");
    if (worker.timingsMs.total >= maximumRuntimeMs - 60_000) throw new Error("LAMBDA_RUNTIME_MARGIN_INADEQUATE");
    if (worker.peakEphemeralBytes >= maximumEphemeralBytes) throw new Error("LAMBDA_EPHEMERAL_MARGIN_INADEQUATE");
    const evidence = {
      schemaVersion: "gonggamline-aws-backup-worker-rehearsal-result-v1",
      status: "SUCCEEDED_SYNTHETIC_ONLY",
      executedAt: new Date().toISOString(),
      productionConnected: false,
      awsConnected: false,
      paidUsageCreated: false,
      scheduleEnabled: false,
      source: {
        kind: "DISPOSABLE_LOCAL_POSTGRESQL_SYNTHETIC_DATA",
        image: postgresImage,
        network: "INTERNAL_NO_HOST_PORT",
      },
      workflow: {
        dumpComplete: true,
        archiveInspectionComplete: true,
        sha256Complete: true,
        immutableUploadContractComplete: true,
        manifestComplete: true,
        retentionReadbackComplete: true,
        cleanupComplete: true,
      },
      capacity: {
        productionObservedArchiveBytes: 715_071,
        requiredStressArchiveBytes: stressArchiveBytes,
        rehearsalArchiveBytes: worker.archive.bytes,
        rehearsalEntryCount: worker.archive.entryCount,
        peakEphemeralBytes: worker.peakEphemeralBytes,
        maximumEphemeralBytes,
        workerMeasuredTotalMs: worker.timingsMs.total,
        harnessElapsedMs: Math.round(performance.now() - started),
        maximumRuntimeMs,
        cleanupReserveMs: 60_000,
        runtimeMarginMs: maximumRuntimeMs - worker.timingsMs.total,
        ephemeralMarginBytes: maximumEphemeralBytes - worker.peakEphemeralBytes,
      },
      immutableObjects: storedObjects.map(({ request, result, retention }) => ({
        keyClass: request.key.endsWith(".dump") ? "ARCHIVE" : "MANIFEST",
        bytes: request.contentLength,
        checksumAlgorithm: "SHA256",
        versionIdPresent: result.versionId.length > 0,
        serverSideEncryption: result.serverSideEncryption,
        kmsKeyMatchesSyntheticContract: result.kmsKeyArn === syntheticKmsKeyArn,
        retentionMode: retention.mode,
        retentionReadbackAtOrBeyondMinimum: Date.parse(retention.retainUntil) >= Date.parse(request.retainUntil),
      })),
      cleanup: {
        rawArchiveRetained: false,
        syntheticObjectBodiesRetained: false,
        temporaryDatabaseRetained: false,
        temporaryNetworkRetained: false,
      },
      decision: "LAMBDA_ELIGIBLE_FOR_DISABLED_WORKER_CHANGE_SET_REVIEW_ONLY",
      authorization: {
        awsProvisioningAuthorized: false,
        productionExportAuthorized: false,
        productionSecretAuthorized: false,
        restoreAuthorized: false,
        scheduleAuthorized: false,
      },
    } as const;
    await rm(temporaryRoot, { recursive: true, force: true });
    await createExclusiveFile(resultPath, `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write("SYNTHETIC_WORKER_REHEARSAL_RESULT_READY\n");
  } catch (error) {
    await source.dispose().catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

void main();
