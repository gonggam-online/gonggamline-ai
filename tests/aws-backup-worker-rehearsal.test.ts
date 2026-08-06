import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const rehearsal = readFileSync(path.join(root, "scripts", "rehearse-aws-backup-worker.ts"), "utf8");
const pipeline = readFileSync(path.join(root, "tools", "aws-backup-worker", "pipeline.ts"), "utf8");
const evidenceSource = readFileSync(
  path.join(root, "docs", "cloud", "aws-backup-worker-rehearsal-v1.json"),
  "utf8",
);
const evidence = JSON.parse(evidenceSource) as Readonly<{
  status: string;
  productionConnected: boolean;
  awsConnected: boolean;
  paidUsageCreated: boolean;
  scheduleEnabled: boolean;
  workflow: Readonly<Record<string, boolean>>;
  capacity: Readonly<{
    requiredStressArchiveBytes: number;
    rehearsalArchiveBytes: number;
    peakEphemeralBytes: number;
    maximumEphemeralBytes: number;
    workerMeasuredTotalMs: number;
    maximumRuntimeMs: number;
    runtimeMarginMs: number;
    ephemeralMarginBytes: number;
  }>;
  cleanup: Readonly<Record<string, boolean>>;
  decision: string;
  authorization: Readonly<Record<string, boolean>>;
}>;

test("rehearsal uses a pinned PostgreSQL 17.6 image and an isolated synthetic database", () => {
  assert.match(rehearsal, /postgres@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929/);
  assert.match(rehearsal, /docker[\s\S]+network[\s\S]+create[\s\S]+--internal/);
  assert.match(rehearsal, /POSTGRES_HOST_AUTH_METHOD=trust/);
  assert.match(rehearsal, /--tmpfs/);
  assert.match(rehearsal, /generate_series\(1, 100000\)/);
  assert.doesNotMatch(rehearsal, /--publish|-p\s+\d/);
});

test("rehearsal proves complete custom archive workflow at or above the 2x stress size", () => {
  assert.match(rehearsal, /"--format", "custom"/);
  assert.match(rehearsal, /"pg_restore", "--list"/);
  assert.match(rehearsal, /stressArchiveBytes = 1_430_142/);
  assert.match(rehearsal, /immutableUploadContractComplete: true/);
  assert.match(rehearsal, /manifestComplete: true/);
  assert.match(rehearsal, /retentionReadbackComplete: true/);
  assert.match(rehearsal, /cleanupComplete: true/);
  assert.match(rehearsal, /LAMBDA_ELIGIBLE_FOR_DISABLED_WORKER_CHANGE_SET_REVIEW_ONLY/);
});

test("rehearsal cannot contact Production or AWS and cannot authorize deployment", () => {
  assert.doesNotMatch(rehearsal, /sxvtznmoemrcwifungnb/);
  assert.doesNotMatch(rehearsal, /supabase\.com/);
  assert.doesNotMatch(rehearsal, /aws-sdk|S3Client|SecretsManagerClient/);
  assert.match(rehearsal, /productionConnected: false/);
  assert.match(rehearsal, /awsConnected: false/);
  assert.match(rehearsal, /awsProvisioningAuthorized: false/);
  assert.match(rehearsal, /productionExportAuthorized: false/);
  assert.match(rehearsal, /scheduleAuthorized: false/);
});

test("worker pipeline uses immutable hash keys, SHA-256, KMS response, and retention readback", () => {
  assert.match(pipeline, /createHash\("sha256"\)/);
  assert.match(pipeline, /putIfAbsent/);
  assert.match(pipeline, /\.dump`/);
  assert.match(pipeline, /\.manifest\.json`/);
  assert.match(pipeline, /serverSideEncryption !== "aws:kms"/);
  assert.match(pipeline, /getRetention/);
  assert.doesNotMatch(pipeline, /GetObject|DeleteObject|BypassGovernance/);
});

test("worker reserves cleanup time and deletes only exact transient files", () => {
  assert.match(pipeline, /cleanupReserveMs/);
  assert.match(pipeline, /path\.dirname\(resolvedFile\) !== resolvedTemporaryDirectory/);
  assert.match(pipeline, /removeExactFile\(filePath, dependencies\.temporaryDirectory\)/);
  assert.match(rehearsal, /this\.dumpContainer, this\.inspectContainer/);
  assert.match(rehearsal, /docker", \["rm", "--force", container\]/);
  assert.match(rehearsal, /docker", \["rm", "--force", this\.databaseContainer\]/);
  assert.match(rehearsal, /docker", \["network", "rm", this\.network\]/);
});

test("sanitized rehearsal evidence closes only the Lambda capacity prerequisite", () => {
  assert.equal(evidence.status, "SUCCEEDED_SYNTHETIC_ONLY");
  assert.equal(evidence.productionConnected, false);
  assert.equal(evidence.awsConnected, false);
  assert.equal(evidence.paidUsageCreated, false);
  assert.equal(evidence.scheduleEnabled, false);
  assert.equal(Object.values(evidence.workflow).every(Boolean), true);
  assert.equal(
    evidence.capacity.rehearsalArchiveBytes >= evidence.capacity.requiredStressArchiveBytes,
    true,
  );
  assert.equal(evidence.capacity.workerMeasuredTotalMs < evidence.capacity.maximumRuntimeMs, true);
  assert.equal(evidence.capacity.peakEphemeralBytes < evidence.capacity.maximumEphemeralBytes, true);
  assert.equal(
    evidence.capacity.maximumRuntimeMs - evidence.capacity.workerMeasuredTotalMs,
    evidence.capacity.runtimeMarginMs,
  );
  assert.equal(
    evidence.capacity.maximumEphemeralBytes - evidence.capacity.peakEphemeralBytes,
    evidence.capacity.ephemeralMarginBytes,
  );
  assert.equal(Object.values(evidence.cleanup).every((retained) => retained === false), true);
  assert.equal(
    evidence.decision,
    "LAMBDA_ELIGIBLE_FOR_DISABLED_WORKER_CHANGE_SET_REVIEW_ONLY",
  );
  assert.equal(Object.values(evidence.authorization).every((authorized) => authorized === false), true);
  assert.doesNotMatch(evidenceSource, /AKIA[0-9A-Z]{16}|password|secret(?:string|value)|supabase\.com/i);
});
