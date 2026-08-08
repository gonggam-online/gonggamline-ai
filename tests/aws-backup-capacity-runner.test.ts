import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runnerPath = path.join(root, "scripts", "measure-production-backup-capacity.ps1");
const runner = readFileSync(runnerPath, "utf8");

test("capacity runner pins the exact Production target and PostgreSQL image", () => {
  assert.match(runner, /aws-0-ap-southeast-1\.pooler\.supabase\.com/);
  assert.match(runner, /postgres\.sxvtznmoemrcwifungnb/);
  assert.match(
    runner,
    /postgres@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929/,
  );
  assert.match(runner, /PostgreSQL\\\) 17\\\.6/);
  assert.match(runner, /PGSSLMODE=require/);
});

test("capacity runner keeps secrets out of arguments and durable output", () => {
  assert.match(runner, /SUPABASE_DB_PASSWORD/);
  assert.match(runner, /WriteAllText\(\$credentialPath/);
  assert.match(runner, /PGPASSFILE=\/run\/secure\/pgpass/);
  assert.match(runner, /\$env:SUPABASE_DB_PASSWORD = \$null/);
  assert.doesNotMatch(runner, /--env[\s\S]{0,80}SUPABASE_DB_PASSWORD/);
  assert.doesNotMatch(runner, /(?:password|secret|token)\s*=\s*["'][^"']{8,}/i);
  assert.doesNotMatch(runner, /connectionString/i);
});

test("capacity runner is complete, bounded, read-only, and validates offline", () => {
  assert.equal((runner.match(/\bpg_dump\b/g) ?? []).length >= 2, true);
  assert.match(runner, /--format custom/);
  assert.doesNotMatch(runner, /--exclude/);
  assert.match(runner, /timeout --signal=TERM 900s pg_dump/);
  assert.match(runner, /"--read-only"/);
  assert.match(runner, /"--cap-drop", "ALL"/);
  assert.match(runner, /"--network", "none"/);
  assert.match(runner, /"pg_restore", "--list"/);
  assert.doesNotMatch(runner, /pg_restore[\s\S]{0,80}(--dbname|-d\s)/);
});

test("capacity runner preserves sanitized evidence independently and cleans exact artifacts", () => {
  assert.match(runner, /\.local-state\/aws-capacity-measurement\/result-v2\.json/);
  assert.match(runner, /refusing to overwrite measurement evidence/i);
  assert.match(runner, /resultEvidenceAvailable = \$true/);
  assert.match(runner, /Remove-ExactMeasurementContainer/);
  assert.match(runner, /\$dumpContainerStarted/);
  assert.match(runner, /\$restoreContainerStarted/);
  assert.match(runner, /gonggamline-capacity-/);
  assert.match(runner, /Remove-Item -LiteralPath \$archivePath/);
  assert.match(runner, /Remove-Item -LiteralPath \$credentialPath/);
  assert.match(runner, /Remove-Item -LiteralPath \$temporaryDirectory -Recurse/);
  assert.match(runner, /MEASUREMENT_RESULT_READY/);
});

test("capacity runner records only approved sanitized measurement fields", () => {
  for (const field of [
    "archiveBytes",
    "dumpDurationSeconds",
    "archiveListEntryCount",
    "warningCount",
    "failureClass",
    "transientArchiveDeleted",
    "credentialFileDeleted",
    "temporaryDirectoryDeleted",
    "databaseMutationPerformed",
    "rawArchiveStoredRemotely",
    "rowContentInspected",
  ]) {
    assert.match(runner, new RegExp(`${field}\\s*=`));
  }
  assert.doesNotMatch(runner, /Write-Output\s+\$json/);
  assert.doesNotMatch(runner, /Write-Host/);
});
