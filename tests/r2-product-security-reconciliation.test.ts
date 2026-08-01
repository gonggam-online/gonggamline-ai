import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildInventoryReport,
  parseInventoryCsv,
  type InventoryRow,
  validateInventory,
} from "../scripts/validate-r2-product-security-inventory";

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
  assert.match(sql, /pg_catalog\.oidvectortypes\(p\.proargtypes\)/);
  assert.match(sql, /pg_catalog\.pg_get_userbyid/);
  assert.match(sql, /pg_catalog\.pg_extension/);
  assert.match(sql, /count_range/);
  assert.match(sql, /'default_acl_state'/);
  assert.match(sql, /object_type\.code::text/);
  assert.match(sql, /public_acl\.grantee = 0/);
  assert.doesNotMatch(sql, /schema_migrations[\s\S]+WHERE version IN/);
  assert.doesNotMatch(sql,
    /^\s*(?:INSERT\s+INTO|UPDATE\s+\S+|DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?|ALTER\s+|DROP\s+|CREATE\s+)/im);
});

const functionSignatures = new Map([
  ["product_mutation_claim_v1", "text, text, text, text, uuid"],
  ["product_mutation_complete_v1", "uuid, bigint, jsonb, uuid, text, text, uuid"],
  ["import_product_v1", "jsonb, text, text, uuid, uuid"],
  ["patch_product_operator_fields_v1", "bigint, timestamp with time zone, jsonb, text, text, uuid, uuid"],
  ["record_product_competition_v1", "bigint, timestamp with time zone, jsonb, text, text, text, uuid, uuid, text"],
  ["record_manual_competition_analysis_v1", "bigint, timestamp with time zone, jsonb, text, text, uuid, uuid"],
  ["record_automatic_competition_analysis_v1", "bigint, timestamp with time zone, jsonb, text, text, uuid, uuid, text"],
]);

const acceptedInventory = (): InventoryRow[] => [
  ...Array.from({ length: 23 }, (_, index) => ({
    category: "migration", schemaName: "supabase_migrations",
    parentName: "schema_migrations", objectName: index.toString().padStart(3, "0"),
    definition: `${index.toString().padStart(3, "0")}_migration`,
  })),
  ...["products", "product_mutation_requests", "security_audit_events"].map((name) => ({
    category: "relation", schemaName: "public", parentName: name,
    objectName: name, definition: "r|postgres|true|false|",
  })),
  { category: "policy", schemaName: "public", parentName: "products", objectName: "Allow public insert products", definition: "PERMISSIVE|anon|INSERT||true" },
  { category: "policy", schemaName: "public", parentName: "products", objectName: "Allow public read products", definition: "PERMISSIVE|anon|SELECT|true|" },
  { category: "policy", schemaName: "public", parentName: "products", objectName: "Allow public update products", definition: "PERMISSIVE|anon|UPDATE|true|true" },
  ...[...functionSignatures].map(([name, signature]) => ({
    category: "function", schemaName: "public", parentName: name,
    objectName: signature, definition: "postgres|true|search_path=pg_catalog, public|",
  })),
  ...["PUBLIC", "anon", "authenticated", "service_role"].flatMap((role) =>
    ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"].map((privilege) => ({
      category: "relation_privilege_state", schemaName: "public", parentName: "products",
      objectName: role, definition: `${privilege}|${role === "anon" && ["SELECT", "INSERT", "UPDATE"].includes(privilege)}`,
    }))),
  ...[...functionSignatures].flatMap(([name, signature]) =>
    ["PUBLIC", "anon", "authenticated", "service_role"].map((role) => ({
      category: "function_privilege_state", schemaName: "public", parentName: name,
      objectName: signature,
      definition: `${role}|EXECUTE|${role === "service_role" && [
        "import_product_v1", "patch_product_operator_fields_v1",
        "record_manual_competition_analysis_v1", "record_automatic_competition_analysis_v1",
      ].includes(name)}`,
    }))),
  { category: "public_owner", schemaName: "public", parentName: "postgres", objectName: "r", definition: "3" },
  { category: "public_function_owner", schemaName: "public", parentName: "postgres", objectName: "f", definition: "7" },
  ...["r", "S", "f"].map((objectType) => ({
    category: "default_acl_state", schemaName: "public", parentName: "postgres",
    objectName: objectType, definition: "postgres=arwdDxt/postgres",
  })),
  { category: "extension", schemaName: "extensions", parentName: "pgcrypto", objectName: "1.3", definition: "" },
  { category: "product_rows", schemaName: "public", parentName: "products", objectName: "count_range", definition: "100-999" },
];

test("R2 validator accepts only the complete known pre-state inventory", () => {
  assert.deepEqual(validateInventory(acceptedInventory()), []);
});

test("R2 validator blocks unknown migrations, policies, and missing default ACL evidence", () => {
  const rows = acceptedInventory();
  rows.push({ category: "migration", schemaName: "supabase_migrations", parentName: "schema_migrations", objectName: "023", definition: "unknown" });
  rows.push({ category: "policy", schemaName: "public", parentName: "products", objectName: "unknown write", definition: "PERMISSIVE|anon|ALL|true|true" });
  const filtered = rows.filter((row) => !(row.category === "default_acl_state" && row.objectName === "S"));
  const errors = validateInventory(filtered).join("\n");
  assert.match(errors, /Migration history/);
  assert.match(errors, /unknown policies/);
  assert.match(errors, /Missing default ACL state/);
});

test("R2 validator rejects secret-like evidence and malformed CSV", () => {
  const rows = acceptedInventory();
  rows[0] = { ...rows[0], definition: "postgresql://user:password@example.invalid/db" };
  assert.match(validateInventory(rows).join("\n"), /secret-like material/);
  assert.throws(() => parseInventoryCsv("wrong,header\n"), /approved v1 contract/);
  assert.throws(() => parseInventoryCsv('category,schema_name,parent_name,object_name,definition\n"open'), /unterminated/);
});

test("R2 validator blocks incomplete grants, RPC drift, and external-work extensions", () => {
  const rows = acceptedInventory().filter((row) => !(row.category === "relation_privilege_state" &&
    row.objectName === "authenticated" && row.definition.startsWith("DELETE|")));
  const rpcIndex = rows.findIndex((row) => row.category === "function_privilege_state" &&
    row.parentName === "product_mutation_claim_v1" && row.definition.startsWith("anon|"));
  rows[rpcIndex] = { ...rows[rpcIndex], definition: "anon|EXECUTE|true" };
  rows.push({ category: "extension", schemaName: "extensions", parentName: "pg_net", objectName: "0.14", definition: "" });
  const errors = validateInventory(rows).join("\n");
  assert.match(errors, /Product privilege state/);
  assert.match(errors, /execute matrix drift/);
  assert.match(errors, /quarantine review: pg_net/);
});

test("R2 report is canonical, deterministic, and contains no catalog rows", () => {
  const rows = acceptedInventory();
  const report = buildInventoryReport(rows);
  const reversed = buildInventoryReport([...rows].reverse());
  assert.equal(report.accepted, true);
  assert.equal(report.fingerprintSha256, reversed.fingerprintSha256);
  assert.match(report.fingerprintSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(report.creatorRoles, ["postgres"]);
  assert.equal(report.productRowRange, "100-999");
  assert.equal("rows" in report, false);
});

test("R2 collector fails closed for Production, missing quarantine, or target drift", () => {
  const script = read("scripts/collect-r2-product-security-inventory.ps1");
  assert.match(script, /ConfirmedNonProduction/);
  assert.match(script, /ConfirmedQuarantined/);
  assert.match(script, /refuses Production markers/);
  assert.match(script, /R2_REHEARSAL_DATABASE_URL/);
  assert.match(script, /does not match the confirmed target project ref/);
  assert.match(script, /--no-psqlrc/);
  assert.match(script, /--quiet/);
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

test("R2 candidate 023 is inventory-bound, transactional, and forward-only", () => {
  const sql = read("supabase/migrations/023_product_security_target.sql");
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /dbf1c4daedf92a85f86513885d8daf4fa2905ca9d1e5e16d123c5697e75a3d56/);
  assert.match(sql, /Product state is mixed or unapproved/);
  assert.match(sql, /v_restored_grants_match/);
  assert.match(sql, /public creator role inventory drifted/);
  assert.match(sql, /restored execute drift classification changed/);
  assert.doesNotMatch(sql, /supabase_migrations|schema_migrations/);
  assert.doesNotMatch(sql, /CREATE ROLE|ALTER ROLE|DROP ROLE/);
});

test("R2 candidate 023 removes anonymous Product writes by exact policy name", () => {
  const sql = read("supabase/migrations/023_product_security_target.sql");
  assert.match(sql, /DROP POLICY IF EXISTS "Allow public insert products" ON public\.products/);
  assert.match(sql, /DROP POLICY IF EXISTS "Allow public update products" ON public\.products/);
  assert.match(sql, /DROP POLICY IF EXISTS "Allow public read products" ON public\.products/);
  assert.match(sql, /CREATE POLICY "Allow public read products"[\s\S]+FOR SELECT TO anon USING \(true\)/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.products FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.products TO anon, service_role/);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]+ON TABLE public\.products/i);
  assert.doesNotMatch(sql, /FOR\s+(?:INSERT|UPDATE|DELETE|ALL)\s+TO\s+(?:PUBLIC|anon|authenticated)/i);
});

test("R2 candidate 023 reasserts the exact R1 execute and default ACL matrix", () => {
  const sql = read("supabase/migrations/023_product_security_target.sql");
  for (const functionName of functionSignatures.keys()) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}`));
  }
  for (const functionName of [
    "import_product_v1", "patch_product_operator_fields_v1",
    "record_manual_competition_analysis_v1", "record_automatic_competition_analysis_v1",
  ]) {
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}`));
  }
  for (const functionName of [
    "product_mutation_claim_v1", "product_mutation_complete_v1",
    "record_product_competition_v1",
  ]) {
    assert.doesNotMatch(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}`));
  }
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]+ON TABLES/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]+ON SEQUENCES/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]+ON FUNCTIONS/);
  assert.match(sql, /browser-facing default privileges remain/);
});

test("R2 candidate 023 accepts only restored drift or canonical 000-022 pre-state", () => {
  const sql = read("supabase/migrations/023_product_security_target.sql");
  assert.match(sql, /v_pre_state := 'RESTORED_DRIFT'/);
  assert.match(sql, /v_pre_state := 'CANONICAL_000_022'/);
  assert.match(sql, /v_policy_state IS NULL/);
  assert.match(sql, /v_restored_grants_match/);
  assert.match(sql, /v_canonical_grants_match/);
  assert.match(sql, /\('SELECT', false\), \('INSERT', false\), \('UPDATE', false\), \('DELETE', false\)/);
  assert.match(sql, /\('TRUNCATE', true\), \('REFERENCES', true\), \('TRIGGER', true\)/);
  assert.match(sql, /Product state is mixed or unapproved/);
  assert.match(sql, /to_regprocedure\('public\.product_mutation_claim_v1/);
  assert.match(sql, /has_function_privilege\('anon', v_function\.function_oid::oid, 'EXECUTE'\)/);
  assert.doesNotMatch(sql, /current_setting\('gonggamline\.r2_pre_state'\)|set_config\('gonggamline\.r2_pre_state'/);
  assert.doesNotMatch(sql, /v_pre_state\s*:=\s*coalesce/i);
});
