import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type BackupClass = "daily" | "monthly";

export type BackupInvocation = Readonly<{
  requestId: string;
  backupClass: BackupClass;
  scheduledAt: string;
  sourceProjectRef: string;
  sourceRegion: "ap-southeast-1";
}>;

export type ArchiveInspection = Readonly<{
  entryCount: number;
  warningCount: number;
  durationMs: number;
}>;

export type ArchiveCreation = Readonly<{
  durationMs: number;
  warningCount: number;
}>;

export interface ArchiveSource {
  create(destinationPath: string): Promise<ArchiveCreation>;
  inspect(archivePath: string): Promise<ArchiveInspection>;
  dispose(): Promise<void>;
}

export type PutObjectRequest = Readonly<{
  key: string;
  filePath: string;
  contentLength: number;
  checksumSha256Base64: string;
  kmsKeyArn: string;
  retainUntil: string;
  metadata: Readonly<Record<string, string>>;
}>;

export type PutObjectResult = Readonly<{
  disposition: "CREATED" | "EXACT_REPLAY";
  versionId: string;
  checksumSha256Base64: string;
  serverSideEncryption: "aws:kms";
  kmsKeyArn: string;
}>;

export type RetentionResult = Readonly<{
  mode: "GOVERNANCE";
  retainUntil: string;
}>;

export interface ImmutableObjectWriter {
  putIfAbsent(request: PutObjectRequest): Promise<PutObjectResult>;
  getRetention(key: string, versionId: string): Promise<RetentionResult>;
}

export type WorkerLimits = Readonly<{
  deadlineEpochMs: number;
  cleanupReserveMs: number;
  maximumEphemeralBytes: number;
  dailyRetentionDays: number;
  monthlyRetentionDays: number;
}>;

export type WorkerDependencies = Readonly<{
  source: ArchiveSource;
  objects: ImmutableObjectWriter;
  temporaryDirectory: string;
  kmsKeyArn: string;
  limits: WorkerLimits;
  now?: () => Date;
  log?: (event: Readonly<Record<string, string | number | boolean>>) => void;
}>;

export type BackupWorkerResult = Readonly<{
  schemaVersion: "gonggamline-backup-worker-result-v1";
  status: "VERIFIED";
  requestId: string;
  backupClass: BackupClass;
  archive: Readonly<{
    key: string;
    versionId: string;
    sha256: string;
    bytes: number;
    entryCount: number;
    disposition: "CREATED" | "EXACT_REPLAY";
  }>;
  manifest: Readonly<{
    key: string;
    versionId: string;
    sha256: string;
    disposition: "CREATED" | "EXACT_REPLAY";
  }>;
  timingsMs: Readonly<{
    dump: number;
    inspect: number;
    uploadAndRetention: number;
    total: number;
  }>;
  peakEphemeralBytes: number;
  retainUntil: string;
}>;

export type BackupWorkerFailureCode =
  | "INVALID_INVOCATION"
  | "DEADLINE_MARGIN_EXHAUSTED"
  | "EPHEMERAL_LIMIT_EXCEEDED"
  | "ARCHIVE_WARNING"
  | "ARCHIVE_EMPTY"
  | "ARCHIVE_VERIFICATION_FAILED"
  | "UPLOAD_CONTRACT_FAILED"
  | "RETENTION_CONTRACT_FAILED"
  | "CLEANUP_FAILED"
  | "UNEXPECTED_FAILURE";

export class BackupWorkerError extends Error {
  constructor(readonly code: BackupWorkerFailureCode) {
    super(code);
    this.name = "BackupWorkerError";
  }
}

type Digest = Readonly<{ hex: string; base64: string }>;

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const kmsArnPattern = /^arn:aws:kms:ap-southeast-1:[0-9]{12}:key\/[0-9a-f-]{36}$/;

function assertInvocation(invocation: BackupInvocation): void {
  if (
    !requestIdPattern.test(invocation.requestId) ||
    invocation.sourceRegion !== "ap-southeast-1" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(invocation.scheduledAt) ||
    Number.isNaN(Date.parse(invocation.scheduledAt)) ||
    invocation.sourceProjectRef.length === 0
  ) {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
}

function ensureDeadline(limits: WorkerLimits, now: () => Date): void {
  if (limits.deadlineEpochMs - now().getTime() <= limits.cleanupReserveMs) {
    throw new BackupWorkerError("DEADLINE_MARGIN_EXHAUSTED");
  }
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function objectPrefix(invocation: BackupInvocation): string {
  const scheduled = new Date(invocation.scheduledAt);
  const year = scheduled.getUTCFullYear().toString().padStart(4, "0");
  const month = (scheduled.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = scheduled.getUTCDate().toString().padStart(2, "0");
  return `${invocation.backupClass}/${year}/${month}/${day}/${invocation.requestId}`;
}

async function digestFile(filePath: string): Promise<Digest> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  const bytes = hash.digest();
  return Object.freeze({ hex: bytes.toString("hex"), base64: bytes.toString("base64") });
}

function validatePutResult(
  result: PutObjectResult,
  expectedChecksum: string,
  expectedKmsKeyArn: string,
): void {
  if (
    result.versionId.length === 0 ||
    result.checksumSha256Base64 !== expectedChecksum ||
    result.serverSideEncryption !== "aws:kms" ||
    result.kmsKeyArn !== expectedKmsKeyArn
  ) {
    throw new BackupWorkerError("UPLOAD_CONTRACT_FAILED");
  }
}

async function validateRetention(
  objects: ImmutableObjectWriter,
  key: string,
  versionId: string,
  minimumRetainUntil: string,
): Promise<void> {
  const retention = await objects.getRetention(key, versionId);
  if (
    retention.mode !== "GOVERNANCE" ||
    Number.isNaN(Date.parse(retention.retainUntil)) ||
    Date.parse(retention.retainUntil) < Date.parse(minimumRetainUntil)
  ) {
    throw new BackupWorkerError("RETENTION_CONTRACT_FAILED");
  }
}

async function removeExactFile(filePath: string, temporaryDirectory: string): Promise<void> {
  const resolvedTemporaryDirectory = path.resolve(temporaryDirectory);
  const resolvedFile = path.resolve(filePath);
  if (path.dirname(resolvedFile) !== resolvedTemporaryDirectory) {
    throw new BackupWorkerError("CLEANUP_FAILED");
  }
  await rm(resolvedFile, { force: true });
}

export async function runBackupWorker(
  invocation: BackupInvocation,
  dependencies: WorkerDependencies,
): Promise<BackupWorkerResult> {
  const now = dependencies.now ?? (() => new Date());
  const log = dependencies.log ?? (() => undefined);
  const startedAt = now().getTime();
  const archivePath = path.join(dependencies.temporaryDirectory, "backup.dump");
  const manifestPath = path.join(dependencies.temporaryDirectory, "manifest.json");
  let peakEphemeralBytes = 0;
  let successfulResult: BackupWorkerResult | undefined;

  assertInvocation(invocation);
  if (!kmsArnPattern.test(dependencies.kmsKeyArn)) {
    throw new BackupWorkerError("INVALID_INVOCATION");
  }
  await mkdir(dependencies.temporaryDirectory, { recursive: true });
  log({ event: "BACKUP_WORKER_STARTED", backupClass: invocation.backupClass });

  try {
    ensureDeadline(dependencies.limits, now);
    const creation = await dependencies.source.create(archivePath);
    if (creation.warningCount !== 0) throw new BackupWorkerError("ARCHIVE_WARNING");

    const archiveStat = await stat(archivePath);
    if (!archiveStat.isFile() || archiveStat.size <= 0) {
      throw new BackupWorkerError("ARCHIVE_EMPTY");
    }
    peakEphemeralBytes = archiveStat.size;
    if (peakEphemeralBytes > dependencies.limits.maximumEphemeralBytes) {
      throw new BackupWorkerError("EPHEMERAL_LIMIT_EXCEEDED");
    }

    ensureDeadline(dependencies.limits, now);
    const inspection = await dependencies.source.inspect(archivePath);
    if (inspection.entryCount <= 0 || inspection.warningCount !== 0) {
      throw new BackupWorkerError("ARCHIVE_VERIFICATION_FAILED");
    }

    const archiveDigest = await digestFile(archivePath);
    const prefix = objectPrefix(invocation);
    const retentionDays = invocation.backupClass === "monthly"
      ? dependencies.limits.monthlyRetentionDays
      : dependencies.limits.dailyRetentionDays;
    const retainUntil = addUtcDays(new Date(invocation.scheduledAt), retentionDays).toISOString();
    const archiveKey = `${prefix}/${archiveDigest.hex}.dump`;
    ensureDeadline(dependencies.limits, now);
    const uploadStartedAt = now().getTime();
    const archivePut = await dependencies.objects.putIfAbsent({
      key: archiveKey,
      filePath: archivePath,
      contentLength: archiveStat.size,
      checksumSha256Base64: archiveDigest.base64,
      kmsKeyArn: dependencies.kmsKeyArn,
      retainUntil,
      metadata: Object.freeze({
        "gonggamline-request-id": invocation.requestId,
        "gonggamline-sha256": archiveDigest.hex,
        "gonggamline-schema": "backup-archive-v1",
      }),
    });
    validatePutResult(archivePut, archiveDigest.base64, dependencies.kmsKeyArn);
    await validateRetention(
      dependencies.objects,
      archiveKey,
      archivePut.versionId,
      retainUntil,
    );

    const manifest = {
      schemaVersion: "gonggamline-backup-manifest-v1",
      requestId: invocation.requestId,
      backupClass: invocation.backupClass,
      scheduledAt: invocation.scheduledAt,
      source: {
        projectRef: invocation.sourceProjectRef,
        region: invocation.sourceRegion,
      },
      archive: {
        key: archiveKey,
        versionId: archivePut.versionId,
        bytes: archiveStat.size,
        sha256: archiveDigest.hex,
        entryCount: inspection.entryCount,
      },
      retention: { mode: "GOVERNANCE", retainUntil },
      verification: {
        archiveWarningCount: creation.warningCount,
        inspectionWarningCount: inspection.warningCount,
        uploadChecksum: "SHA256",
        bodyReadByWriter: false,
      },
    } as const;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, { encoding: "utf8", flag: "wx" });
    const manifestStat = await stat(manifestPath);
    peakEphemeralBytes = archiveStat.size + manifestStat.size;
    if (peakEphemeralBytes > dependencies.limits.maximumEphemeralBytes) {
      throw new BackupWorkerError("EPHEMERAL_LIMIT_EXCEEDED");
    }
    const manifestDigest = await digestFile(manifestPath);
    const manifestKey = `${prefix}/${manifestDigest.hex}.manifest.json`;
    ensureDeadline(dependencies.limits, now);
    const manifestPut = await dependencies.objects.putIfAbsent({
      key: manifestKey,
      filePath: manifestPath,
      contentLength: manifestStat.size,
      checksumSha256Base64: manifestDigest.base64,
      kmsKeyArn: dependencies.kmsKeyArn,
      retainUntil,
      metadata: Object.freeze({
        "gonggamline-request-id": invocation.requestId,
        "gonggamline-sha256": manifestDigest.hex,
        "gonggamline-schema": "backup-manifest-v1",
      }),
    });
    validatePutResult(manifestPut, manifestDigest.base64, dependencies.kmsKeyArn);
    await validateRetention(
      dependencies.objects,
      manifestKey,
      manifestPut.versionId,
      retainUntil,
    );

    successfulResult = Object.freeze({
      schemaVersion: "gonggamline-backup-worker-result-v1",
      status: "VERIFIED",
      requestId: invocation.requestId,
      backupClass: invocation.backupClass,
      archive: Object.freeze({
        key: archiveKey,
        versionId: archivePut.versionId,
        sha256: archiveDigest.hex,
        bytes: archiveStat.size,
        entryCount: inspection.entryCount,
        disposition: archivePut.disposition,
      }),
      manifest: Object.freeze({
        key: manifestKey,
        versionId: manifestPut.versionId,
        sha256: manifestDigest.hex,
        disposition: manifestPut.disposition,
      }),
      timingsMs: Object.freeze({
        dump: creation.durationMs,
        inspect: inspection.durationMs,
        uploadAndRetention: now().getTime() - uploadStartedAt,
        total: 0,
      }),
      peakEphemeralBytes,
      retainUntil,
    });
  } catch (error) {
    const sanitizedError = error instanceof BackupWorkerError
      ? error
      : new BackupWorkerError("UNEXPECTED_FAILURE");
    log({
      event: "BACKUP_WORKER_FAILED",
      code: sanitizedError.code,
    });
    throw sanitizedError;
  } finally {
    const cleanupErrors: unknown[] = [];
    for (const filePath of [manifestPath, archivePath]) {
      try {
        await removeExactFile(filePath, dependencies.temporaryDirectory);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await dependencies.source.dispose();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length > 0) {
      log({ event: "BACKUP_WORKER_CLEANUP_FAILED", code: "CLEANUP_FAILED" });
      throw new BackupWorkerError("CLEANUP_FAILED");
    }
  }
  if (!successfulResult) throw new BackupWorkerError("UNEXPECTED_FAILURE");
  const completedResult: BackupWorkerResult = Object.freeze({
    ...successfulResult,
    timingsMs: Object.freeze({
      ...successfulResult.timingsMs,
      total: now().getTime() - startedAt,
    }),
  });
  log({
    event: "BACKUP_WORKER_VERIFIED",
    bytes: completedResult.archive.bytes,
    entries: completedResult.archive.entryCount,
  });
  return completedResult;
}

export async function createExclusiveFile(filePath: string, contents: string): Promise<void> {
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
}
