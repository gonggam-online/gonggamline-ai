import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("R2 inventory is read-only and captures every architecture stop condition", () => {
  const sql = read("supabase/rehearsal/r2_product_security_inventory.sql");
  assert.match(sql, /BEGIN READ ONLY/);
  assert.match(sql, /ROLLBACK/);
  assert.match(sql, /supabase_migrations\.schema_migrations/);
  assert.match(sql, /pg_catalog\.pg_policies/);
  assert.match(sql, /pg_catalog\.aclexplode/);
  assert.match(sql, /pg_catalog\.pg_default_acl/);
  assert.match(sql, /pg_catalog\.pg_get_function_identity_arguments/);
  assert.match(sql, /pg_catalog\.pg_get_userbyid/);
  assert.match(sql, /pg_catalog\.pg_extension/);
  assert.match(sql, /count_range/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/i);
});

test("R2 collector fails closed for Production, missing quarantine, or target drift", () => {
  const script = read("scripts/collect-r2-product-security-inventory.ps1");
  assert.match(script, /ConfirmedNonProduction/);
  assert.match(script, /ConfirmedQuarantined/);
  assert.match(script, /refuses Production markers/);
  assert.match(script, /R2_REHEARSAL_DATABASE_URL/);
  assert.match(script, /does not match the confirmed target project ref/);
  assert.match(script, /--no-psqlrc/);
  assert.match(script, /--csv/);
  assert.doesNotMatch(script, /db push|--linked|migration up|db reset/);
});

test("R2 inventory fixes the complete R1 Product function set", () => {
  const sql = read("supabase/rehearsal/r2_product_security_inventory.sql");
  for (const fn of [
    "product_mutation_claim_v1",
    "product_mutation_complete_v1",
    "import_product_v1",
    "patch_product_operator_fields_v1",
    "record_product_competition_v1",
    "record_manual_competition_analysis_v1",
    "record_automatic_competition_analysis_v1",
  ]) {
    assert.match(sql, new RegExp(`'${fn}'`));
  }
});

test("R2 inventory never emits Product values or secret material", () => {
  const sql = read("supabase/rehearsal/r2_product_security_inventory.sql");
  assert.doesNotMatch(sql, /SELECT\s+\*\s+FROM\s+public\.products/i);
  assert.doesNotMatch(sql, /title|keyword|product_no|email|token|secret|password/i);
  const script = read("scripts/collect-r2-product-security-inventory.ps1");
  assert.doesNotMatch(script, /Write-Output\s+\$databaseUrl/);
});
