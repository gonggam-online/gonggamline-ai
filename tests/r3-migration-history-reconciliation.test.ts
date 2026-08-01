import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("R3 catalog classification is read-only and sanitized by contract", () => {
  const sql = read(
    "supabase/recovery-sources/r3-migration-history-classification.sql",
  );

  assert.match(sql, /BEGIN READ ONLY;/);
  assert.match(sql, /ROLLBACK;/);
  assert.match(sql, /to_regclass\('supabase_migrations\.schema_migrations'\)/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i);
  assert.doesNotMatch(sql, /(?:password|service_role_key|anon_key|postgres(?:ql)?:\/\/)/i);
});

test("R3 architecture preserves official repair and manual approval boundaries", () => {
  const architecture = read(
    "docs/architecture/R3-MIGRATION-HISTORY-RECONCILIATION-V1.md",
  );

  assert.match(architecture, /migration repair \.\.\. --status applied/);
  assert.match(architecture, /Direct SQL against[\s\S]*permanently prohibited/);
  assert.match(architecture, /db push --dry-run/);
  assert.match(architecture, /only the exact approved 023 artifact/);
  assert.match(architecture, /manual acceptance/);
  assert.match(architecture, /does not approve[\s\S]*Production mutation/);
});
