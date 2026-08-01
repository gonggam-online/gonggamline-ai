import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

type ManifestMigration = Readonly<{
  order: number;
  file: string;
  sha256: string;
}>;

type BaselineManifest = Readonly<{
  schemaVersion: string;
  supabaseCliVersion: string;
  migrations: ManifestMigration[];
}>;

export type RehearsalCycle = Readonly<{
  id: string;
  freshRestore: boolean;
  catalogBeforeSha256: string;
  catalogAfterSha256: string;
  productRowsBeforeSha256: string;
  productRowsAfterSha256: string;
  historyBefore: string[];
  historyAfter: string[];
  dryRunPending: string[];
  repairPlanSha256: string;
  negative: Readonly<{
    unknownVersionBlocked: boolean;
    schemaMutationBlocked: boolean;
    productRowsUnchanged: boolean;
  }>;
}>;

export type RehearsalEvidence = Readonly<{
  schemaVersion: string;
  backupSha256: string;
  supabaseCliVersion: string;
  quarantine: Readonly<{
    production: boolean;
    networkMode: string;
    publishedPorts: number[];
  }>;
  manifest: ManifestMigration[];
  cycles: RehearsalCycle[];
  sanitized: boolean;
}>;

const sha256Pattern = /^[0-9a-f]{64}$/;
const sensitivePattern = /(?:postgres(?:ql)?:\/\/|password|service[_-]?role|anon[_-]?key|bearer\s+|eyJ[A-Za-z0-9_-]{10,}\.)/i;

function canonicalLfSha256(contents: Buffer | string): string {
  return createHash("sha256")
    .update(contents.toString().replaceAll("\r\n", "\n"), "utf8")
    .digest("hex");
}

export function buildRepairPlanFingerprint(
  cliVersion: string,
  versions: readonly string[],
): string {
  const plan = JSON.stringify({
    cli: `supabase@${cliVersion}`,
    operation: "migration repair --status applied",
    targetClass: "owner-approved-isolated-restore",
    versions,
  });
  return createHash("sha256").update(plan, "utf8").digest("hex");
}

export function validateRehearsalEvidence(
  evidence: RehearsalEvidence,
  manifest: BaselineManifest,
  readMigration: (fileName: string) => Buffer | string,
): string[] {
  const errors: string[] = [];
  const versions = manifest.migrations.map(({ order }) => order.toString().padStart(3, "0"));
  const expectedPlan = buildRepairPlanFingerprint(manifest.supabaseCliVersion, versions);

  if (sensitivePattern.test(JSON.stringify(evidence))) errors.push("Evidence contains secret-like material.");
  if (evidence.schemaVersion !== "gonggamline-r3-history-rehearsal-evidence-v1") errors.push("Unknown evidence schema version.");
  if (!sha256Pattern.test(evidence.backupSha256)) errors.push("Backup SHA-256 is invalid.");
  if (evidence.supabaseCliVersion !== manifest.supabaseCliVersion) errors.push("Supabase CLI version is not pinned to the manifest.");
  if (evidence.quarantine.production || evidence.quarantine.networkMode !== "none" || evidence.quarantine.publishedPorts.length !== 0) {
    errors.push("Target is not a network-none, port-free, non-Production quarantine.");
  }
  if (!evidence.sanitized) errors.push("Evidence is not declared sanitized.");

  if (JSON.stringify(evidence.manifest) !== JSON.stringify(manifest.migrations)) {
    errors.push("Evidence manifest does not exactly match the repository manifest.");
  }
  for (const migration of manifest.migrations) {
    if (canonicalLfSha256(readMigration(migration.file)) !== migration.sha256) {
      errors.push(`Migration artifact drift: ${migration.file}`);
    }
  }

  if (evidence.cycles.length !== 2 || new Set(evidence.cycles.map(({ id }) => id)).size !== 2) {
    errors.push("Exactly two distinct rehearsal cycles are required.");
  }
  for (const cycle of evidence.cycles) {
    if (!cycle.freshRestore) errors.push(`${cycle.id}: restore is not fresh.`);
    for (const [name, value] of Object.entries({
      catalogBeforeSha256: cycle.catalogBeforeSha256,
      catalogAfterSha256: cycle.catalogAfterSha256,
      productRowsBeforeSha256: cycle.productRowsBeforeSha256,
      productRowsAfterSha256: cycle.productRowsAfterSha256,
      repairPlanSha256: cycle.repairPlanSha256,
    })) {
      if (!sha256Pattern.test(value)) errors.push(`${cycle.id}: ${name} is invalid.`);
    }
    if (cycle.catalogBeforeSha256 !== cycle.catalogAfterSha256) errors.push(`${cycle.id}: catalog changed during history repair.`);
    if (cycle.productRowsBeforeSha256 !== cycle.productRowsAfterSha256) errors.push(`${cycle.id}: Product rows changed during history repair.`);
    if (cycle.historyBefore.length !== 0) errors.push(`${cycle.id}: history was not absent before repair.`);
    if (JSON.stringify(cycle.historyAfter) !== JSON.stringify(versions)) errors.push(`${cycle.id}: repaired history is not exactly 000-022.`);
    if (cycle.dryRunPending.length !== 0) errors.push(`${cycle.id}: dry-run contains pending historical or unapproved DDL.`);
    if (cycle.repairPlanSha256 !== expectedPlan) errors.push(`${cycle.id}: repair plan fingerprint is not approved.`);
    if (!cycle.negative.unknownVersionBlocked || !cycle.negative.schemaMutationBlocked ||
        !cycle.negative.productRowsUnchanged) errors.push(`${cycle.id}: negative gates did not all fail closed.`);
  }
  if (evidence.cycles.length === 2) {
    const [first, second] = evidence.cycles;
    if (first.catalogBeforeSha256 !== second.catalogBeforeSha256 ||
        first.catalogAfterSha256 !== second.catalogAfterSha256 ||
        first.productRowsBeforeSha256 !== second.productRowsBeforeSha256 ||
        first.productRowsAfterSha256 !== second.productRowsAfterSha256) {
      errors.push("Fresh-restore cycles are not deterministic.");
    }
  }
  return [...new Set(errors)];
}

if (process.argv[1]?.endsWith("validate-r3-history-rehearsal.ts")) {
  const evidencePath = process.argv[2];
  if (!evidencePath) throw new Error("Pass the sanitized R3 rehearsal evidence JSON path.");
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const manifest = JSON.parse(readFileSync(path.join(repositoryRoot, "supabase", "baseline-manifest.json"), "utf8")) as BaselineManifest;
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as RehearsalEvidence;
  const errors = validateRehearsalEvidence(evidence, manifest, (fileName) =>
    readFileSync(path.join(repositoryRoot, "supabase", "migrations", fileName)));
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`BLOCKED: ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${JSON.stringify({ accepted: true, schemaVersion: evidence.schemaVersion }, null, 2)}\n`);
  }
}
