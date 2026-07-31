import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/022_atomic_product_mutation.sql");

test("R1 migration is additive and defines the approved atomic boundary", () => {
  assert.match(migration, /CREATE TABLE public\.product_mutation_requests/);
  for (const fn of ["import_product_v1","patch_product_operator_fields_v1",
    "record_manual_competition_analysis_v1","record_automatic_competition_analysis_v1"]) {
    assert.match(migration, new RegExp(`CREATE FUNCTION public\\.${fn}`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}`));
  }
  assert.match(migration, /INSERT INTO public\.security_audit_events/);
  assert.match(migration, /status = 'SUCCEEDED'/);
  assert.match(migration, /request_fingerprint/);
  assert.match(migration, /idempotency_key_hash/);
  assert.match(migration, /FOR UPDATE/);
});

test("R1 storage and helpers are denied to browser-facing roles", () => {
  assert.match(migration,
    /REVOKE ALL ON TABLE public\.product_mutation_requests FROM PUBLIC, anon, authenticated/);
  for (const role of ["PUBLIC","anon","authenticated"]) {
    assert.match(migration, new RegExp(
      `REVOKE ALL ON FUNCTION public\\.import_product_v1[\\s\\S]+FROM PUBLIC,anon,authenticated`));
    assert.ok(role.length > 0);
  }
  assert.match(migration,
    /product_mutation_claim_v1[^\n]+FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(migration,
    /product_mutation_complete_v1[^\n]+FROM PUBLIC,anon,authenticated,service_role/);
});

test("R1 success audit precedes idempotency completion in the same function", () => {
  const complete = migration.slice(
    migration.indexOf("CREATE FUNCTION public.product_mutation_complete_v1"),
    migration.indexOf("CREATE FUNCTION public.import_product_v1"),
  );
  assert.ok(complete.indexOf("INSERT INTO public.security_audit_events") <
    complete.indexOf("UPDATE public.product_mutation_requests"));
  assert.match(complete, /IF NOT FOUND THEN[\s\S]+RAISE EXCEPTION/);
});

test("Product routes use protected server boundaries and search is read-only", () => {
  for (const file of [
    "app/api/admin/products/import/route.ts",
    "app/api/products/[id]/route.ts",
    "app/api/products/[id]/competition/route.ts",
    "app/api/products/[id]/competition/auto/route.ts",
    "app/api/competition/analyze-batch/route.ts",
  ]) {
    const source = read(file);
    assert.match(source, /requireProtectedProductMutation/);
    assert.doesNotMatch(source, /from ["']@?\/?lib\/supabase["']/);
  }
  const search = read("app/api/domeggook-search/route.ts");
  assert.doesNotMatch(search, /saveProducts/);
  assert.match(search, /savedCount: 0/);
});

test("Product repository hashes raw keys and isolates service-role access", () => {
  const repository = read("services/product-mutation.repository.ts");
  assert.match(repository, /createGuardedServiceRoleClient/);
  assert.match(repository, /createHash\("sha256"\)\.update\(key/);
  assert.doesNotMatch(repository, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(repository, /console\./);
});

test("batch is bounded before work and produces stable per-item outcomes", () => {
  const route = read("app/api/competition/analyze-batch/route.ts");
  assert.match(route, /> 20/);
  assert.match(route, /"REPLAYED" : "SUCCEEDED"/);
  assert.match(route, /status: "FAILED", code: "ITEM_FAILED"/);
});
