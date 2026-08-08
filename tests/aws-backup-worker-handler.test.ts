import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyExistingKeys,
  parseDatabaseSecret,
  resolveInvocation,
} from "../tools/aws-backup-worker/handler";
import { BackupWorkerError } from "../tools/aws-backup-worker/pipeline";

test("database secret parser accepts only the bounded JSON contract", () => {
  const parsed = parseDatabaseSecret(JSON.stringify({
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    username: "postgres.projectref",
    password: "secret-value",
    sslmode: "require",
  }));
  assert.equal(parsed.password, "secret-value");

  for (const invalid of [
    "not-json",
    JSON.stringify({ host: "bad host", port: 5432, database: "postgres", username: "postgres", password: "secret-value", sslmode: "require" }),
    JSON.stringify({ host: "db.example.com", port: 5432, database: "postgres", username: "postgres", password: "short", sslmode: "require" }),
    JSON.stringify({ host: "db.example.com", port: 5432, database: "postgres", username: "postgres", password: "secret-value", sslmode: "disable" }),
  ]) {
    assert.throws(
      () => parseDatabaseSecret(invalid),
      (error: unknown) => error instanceof BackupWorkerError && error.code === "INVALID_INVOCATION",
    );
  }
});

test("scheduled invocation is deterministic for one Singapore calendar day", () => {
  const first = resolveInvocation(
    { mode: "scheduled", version: 1 },
    "project-ref",
    new Date("2026-08-08T18:00:00.000Z"),
  );
  const retry = resolveInvocation(
    { mode: "scheduled", version: 1 },
    "project-ref",
    new Date("2026-08-08T18:30:00.000Z"),
  );
  assert.equal(first.requestId, "scheduled-2026-08-09");
  assert.equal(first.requestId, retry.requestId);
  assert.equal(first.backupClass, "daily");
});

test("first Singapore calendar day uses monthly retention class", () => {
  const invocation = resolveInvocation(
    { mode: "scheduled", version: 1 },
    "project-ref",
    new Date("2026-08-31T18:00:00.000Z"),
  );
  assert.equal(invocation.requestId, "scheduled-2026-09-01");
  assert.equal(invocation.backupClass, "monthly");
});

test("existing request prefix is complete only with one archive and one manifest", () => {
  assert.equal(classifyExistingKeys([]), "EMPTY");
  assert.equal(classifyExistingKeys([
    "daily/2026/08/08/request/a.dump",
    "daily/2026/08/08/request/b.manifest.json",
  ]), "COMPLETE");
  assert.equal(classifyExistingKeys(["daily/2026/08/08/request/a.dump"]), "PARTIAL");
  assert.equal(classifyExistingKeys([
    "daily/2026/08/08/request/a.dump",
    "daily/2026/08/08/request/b.dump",
    "daily/2026/08/08/request/c.manifest.json",
  ]), "PARTIAL");
});
