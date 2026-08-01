import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildRepairPlanFingerprint,
  type RehearsalEvidence,
  validateRehearsalEvidence,
} from "../scripts/validate-r3-history-rehearsal.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(
  path.join(repositoryRoot, "supabase", "baseline-manifest.json"), "utf8"));
const versions = manifest.migrations.map(({ order }: { order: number }) =>
  order.toString().padStart(3, "0"));
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const repairPlanSha256 = buildRepairPlanFingerprint(manifest.supabaseCliVersion, versions);

function validEvidence(): RehearsalEvidence {
  const cycle = (id: string) => ({
    id,
    freshRestore: true,
    catalogBeforeSha256: hashA,
    catalogAfterSha256: hashA,
    productRowsBeforeSha256: hashB,
    productRowsAfterSha256: hashB,
    historyBefore: [],
    historyAfter: versions,
    dryRunPending: [],
    repairPlanSha256,
    negative: {
      unknownVersionBlocked: true,
      schemaMutationBlocked: true,
      productRowsUnchanged: true,
    },
  });
  return {
    schemaVersion: "gonggamline-r3-history-rehearsal-evidence-v1",
    backupSha256: "c".repeat(64),
    supabaseCliVersion: manifest.supabaseCliVersion,
    quarantine: { production: false, networkMode: "none", publishedPorts: [] },
    manifest: manifest.migrations,
    cycles: [cycle("cycle-a"), cycle("cycle-b")],
    sanitized: true,
  };
}

function validate(evidence: RehearsalEvidence): string[] {
  return validateRehearsalEvidence(evidence, manifest, (fileName) =>
    readFileSync(path.join(repositoryRoot, "supabase", "migrations", fileName)));
}

test("R3 rehearsal accepts only complete deterministic two-cycle evidence", () => {
  assert.deepEqual(validate(validEvidence()), []);
});

test("R3 rehearsal rejects history, catalog, row, dry-run, and quarantine drift", () => {
  const cases: RehearsalEvidence[] = [
    { ...validEvidence(), quarantine: { production: true, networkMode: "none", publishedPorts: [] } },
    { ...validEvidence(), cycles: validEvidence().cycles.map((cycle, index) => index === 0 ? { ...cycle, historyAfter: versions.slice(0, -1) } : cycle) },
    { ...validEvidence(), cycles: validEvidence().cycles.map((cycle, index) => index === 0 ? { ...cycle, catalogAfterSha256: "d".repeat(64) } : cycle) },
    { ...validEvidence(), cycles: validEvidence().cycles.map((cycle, index) => index === 0 ? { ...cycle, productRowsAfterSha256: "e".repeat(64) } : cycle) },
    { ...validEvidence(), cycles: validEvidence().cycles.map((cycle, index) => index === 0 ? { ...cycle, dryRunPending: ["000_products_baseline.sql"] } : cycle) },
    { ...validEvidence(), cycles: validEvidence().cycles.map((cycle, index) => index === 0 ? { ...cycle, repairPlanSha256: "f".repeat(64) } : cycle) },
  ];
  for (const evidence of cases) assert.notDeepEqual(validate(evidence), []);
});

test("R3 rehearsal rejects secrets, migration drift, and incomplete negative gates", () => {
  const secretLikeValue = ["postgres", "ql://secret"].join("");
  assert.notDeepEqual(validate({ ...validEvidence(), schemaVersion: secretLikeValue }), []);
  assert.notDeepEqual(validate({ ...validEvidence(), manifest: manifest.migrations.slice(0, -1) }), []);
  const evidence = validEvidence();
  assert.notDeepEqual(validate({
    ...evidence,
    cycles: evidence.cycles.map((cycle, index) => index === 0 ? {
      ...cycle,
      negative: { ...cycle.negative, unknownVersionBlocked: false },
    } : cycle),
  }), []);
});

test("R3 implementation contains no executable repair or direct history SQL", () => {
  const validator = readFileSync(
    path.join(repositoryRoot, "scripts", "validate-r3-history-rehearsal.ts"), "utf8");
  const runbook = readFileSync(
    path.join(repositoryRoot, "docs", "security", "R3-HISTORY-REHEARSAL-IMPLEMENTATION.md"), "utf8");

  assert.equal(/child_process|spawn\(|execFile\(|exec\(/.test(validator), false);
  assert.equal(/insert\s+into\s+supabase_migrations/i.test(validator), false);
  assert.match(runbook, /No repair runner is included yet/);
  assert.match(runbook, /Production remains[\s\S]*prohibited/);
});
