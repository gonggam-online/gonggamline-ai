import assert from "node:assert/strict";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  type ArchiveSource,
  BackupWorkerError,
  type ImmutableObjectWriter,
  type PutObjectRequest,
  type PutObjectResult,
  type RetentionResult,
  runBackupWorker,
} from "../tools/aws-backup-worker/pipeline";

const kmsKeyArn = "arn:aws:kms:ap-southeast-1:123456789012:key/11111111-2222-3333-4444-555555555555";
const invocation = Object.freeze({
  requestId: "test-request-1",
  backupClass: "daily" as const,
  scheduledAt: "2026-08-06T00:00:00.000Z",
  sourceProjectRef: "synthetic-test",
  sourceRegion: "ap-southeast-1" as const,
});

class FakeSource implements ArchiveSource {
  disposed = false;

  constructor(
    private readonly bytes = Buffer.from("synthetic custom archive"),
    private readonly creationWarningCount = 0,
    private readonly inspectionEntryCount = 2,
  ) {}

  async create(destinationPath: string) {
    await writeFile(destinationPath, this.bytes, { flag: "wx" });
    return Object.freeze({ durationMs: 31, warningCount: this.creationWarningCount });
  }

  async inspect() {
    return Object.freeze({
      entryCount: this.inspectionEntryCount,
      warningCount: 0,
      durationMs: 7,
    });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

class FakeObjects implements ImmutableObjectWriter {
  readonly requests: PutObjectRequest[] = [];
  readonly bodies = new Map<string, string>();

  constructor(
    private readonly corruptChecksum = false,
    private readonly disposition: "CREATED" | "EXACT_REPLAY" = "CREATED",
  ) {}

  async putIfAbsent(request: PutObjectRequest): Promise<PutObjectResult> {
    this.requests.push(request);
    this.bodies.set(request.key, await import("node:fs/promises").then(({ readFile }) =>
      readFile(request.filePath, "utf8")));
    return Object.freeze({
      disposition: this.disposition,
      versionId: `version-${this.requests.length}`,
      checksumSha256Base64: this.corruptChecksum ? "wrong" : request.checksumSha256Base64,
      serverSideEncryption: "aws:kms",
      kmsKeyArn: request.kmsKeyArn,
    });
  }

  async getRetention(key: string, versionId: string): Promise<RetentionResult> {
    const request = this.requests.find(({ key: candidate }) => candidate === key);
    assert.ok(request);
    assert.ok(versionId.startsWith("version-"));
    return Object.freeze({ mode: "GOVERNANCE", retainUntil: request.retainUntil });
  }
}

function limits(now: number, overrides: Partial<{
  deadlineEpochMs: number;
  cleanupReserveMs: number;
  maximumEphemeralBytes: number;
}> = {}) {
  return Object.freeze({
    deadlineEpochMs: overrides.deadlineEpochMs ?? now + 900_000,
    cleanupReserveMs: overrides.cleanupReserveMs ?? 60_000,
    maximumEphemeralBytes: overrides.maximumEphemeralBytes ?? 10_240 * 1024 * 1024,
    dailyRetentionDays: 35,
    monthlyRetentionDays: 365,
  });
}

test("worker completes dump, inspection, immutable archive, manifest, retention, and cleanup", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-pipeline-test-"));
  const source = new FakeSource();
  const objects = new FakeObjects();
  const now = Date.parse("2026-08-06T00:00:00.000Z");
  const result = await runBackupWorker(invocation, {
    source,
    objects,
    temporaryDirectory,
    kmsKeyArn,
    limits: limits(now),
    now: () => new Date(now),
  });

  assert.equal(result.status, "VERIFIED");
  assert.equal(result.archive.entryCount, 2);
  assert.equal(result.retainUntil, "2026-09-10T00:00:00.000Z");
  assert.equal(objects.requests.length, 2);
  assert.match(objects.requests[0]?.key ?? "", /^daily\/2026\/08\/06\/test-request-1\/[a-f0-9]{64}\.dump$/);
  assert.match(objects.requests[1]?.key ?? "", /^daily\/2026\/08\/06\/test-request-1\/[a-f0-9]{64}\.manifest\.json$/);
  assert.equal(objects.requests.every(({ kmsKeyArn: value }) => value === kmsKeyArn), true);
  assert.equal(source.disposed, true);
  await assert.rejects(stat(path.join(temporaryDirectory, "backup.dump")));
  await assert.rejects(stat(path.join(temporaryDirectory, "manifest.json")));
});

test("manifest contains only the approved contract and never a credential", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-manifest-test-"));
  const objects = new FakeObjects();
  await runBackupWorker(invocation, {
    source: new FakeSource(),
    objects,
    temporaryDirectory,
    kmsKeyArn,
    limits: limits(Date.now()),
  });
  const manifestRequest = objects.requests.find(({ key }) => key.endsWith(".manifest.json"));
  assert.ok(manifestRequest);
  const manifestBody = objects.bodies.get(manifestRequest.key);
  assert.ok(manifestBody);
  const manifest = JSON.parse(manifestBody) as Record<string, unknown>;
  assert.equal(manifest.schemaVersion, "gonggamline-backup-manifest-v1");
  assert.equal(JSON.stringify(manifest).includes("password"), false);
  assert.equal(JSON.stringify(manifest).includes("DATABASE_URL"), false);
  assert.equal(JSON.stringify(objects.requests).includes("password"), false);
  assert.equal(JSON.stringify(objects.requests).includes("DATABASE_URL"), false);
});

test("worker rejects upload checksum drift and still removes transient files", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-checksum-test-"));
  const source = new FakeSource();
  await assert.rejects(
    runBackupWorker(invocation, {
      source,
      objects: new FakeObjects(true),
      temporaryDirectory,
      kmsKeyArn,
      limits: limits(Date.now()),
    }),
    (error: unknown) => error instanceof BackupWorkerError && error.code === "UPLOAD_CONTRACT_FAILED",
  );
  assert.equal(source.disposed, true);
  await assert.rejects(stat(path.join(temporaryDirectory, "backup.dump")));
});

test("worker reports an exact immutable replay without weakening verification", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-replay-test-"));
  const result = await runBackupWorker(invocation, {
    source: new FakeSource(),
    objects: new FakeObjects(false, "EXACT_REPLAY"),
    temporaryDirectory,
    kmsKeyArn,
    limits: limits(Date.now()),
  });
  assert.equal(result.archive.disposition, "EXACT_REPLAY");
  assert.equal(result.manifest.disposition, "EXACT_REPLAY");
  assert.equal(result.status, "VERIFIED");
});

test("worker refuses insufficient cleanup margin before creating an archive", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-deadline-test-"));
  const source = new FakeSource();
  const now = Date.now();
  await assert.rejects(
    runBackupWorker(invocation, {
      source,
      objects: new FakeObjects(),
      temporaryDirectory,
      kmsKeyArn,
      limits: limits(now, { deadlineEpochMs: now + 59_999 }),
      now: () => new Date(now),
    }),
    (error: unknown) => error instanceof BackupWorkerError && error.code === "DEADLINE_MARGIN_EXHAUSTED",
  );
  assert.equal(source.disposed, true);
});

test("worker rejects warning-bearing or oversized archives without upload", async () => {
  for (const scenario of [
    { source: new FakeSource(Buffer.from("archive"), 1), maximumEphemeralBytes: 1024, code: "ARCHIVE_WARNING" },
    { source: new FakeSource(Buffer.alloc(2048)), maximumEphemeralBytes: 1024, code: "EPHEMERAL_LIMIT_EXCEEDED" },
  ] as const) {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-negative-test-"));
    const objects = new FakeObjects();
    await assert.rejects(
      runBackupWorker(invocation, {
        source: scenario.source,
        objects,
        temporaryDirectory,
        kmsKeyArn,
        limits: limits(Date.now(), { maximumEphemeralBytes: scenario.maximumEphemeralBytes }),
      }),
      (error: unknown) => error instanceof BackupWorkerError && error.code === scenario.code,
    );
    assert.equal(objects.requests.length, 0);
  }
});

test("worker rejects non-Singapore targets and secret-like request identifiers", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "worker-invocation-test-"));
  for (const invalid of [
    { ...invocation, sourceRegion: "us-east-1" },
    { ...invocation, requestId: "request/escape" },
  ]) {
    await assert.rejects(
      runBackupWorker(invalid as typeof invocation, {
        source: new FakeSource(),
        objects: new FakeObjects(),
        temporaryDirectory,
        kmsKeyArn,
        limits: limits(Date.now()),
      }),
      (error: unknown) => error instanceof BackupWorkerError && error.code === "INVALID_INVOCATION",
    );
  }
});
