import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string): string =>
  readFileSync(path.join(root, relative), "utf8").replaceAll("\r\n", "\n");

const migration021 = read("supabase/migrations/021_item_selection_security_vertical_slice.sql");
const migration024 = read("supabase/migrations/024_item_selection_stale_recovery.sql");
const repository = read("services/item-selection-run.repository.ts");

test("Story 3 audit preserves the existing aggregate transaction and idempotency boundary", () => {
  assert.match(migration021, /CREATE FUNCTION public\.create_item_selection_run_v1/);
  assert.match(migration021, /CREATE FUNCTION public\.finalize_item_selection_run_v1/);
  assert.match(migration021, /FOR UPDATE;/);
  assert.match(migration021, /Divergent finalization conflict/);
  assert.match(migration021, /INSERT INTO public\.item_selection_evaluations[\s\S]+UPDATE public\.item_selection_runs/);
  assert.doesNotMatch(migration024, /CREATE TABLE|CREATE TYPE/);
});

test("stale recovery is a locked database-clock transition with no invented completion", () => {
  assert.match(migration024, /CREATE FUNCTION public\.reconcile_stale_item_selection_run_v1/);
  assert.match(migration024, /WHERE id = p_run_id\s+FOR UPDATE;/);
  assert.match(migration024, /statement_timestamp\(\) - interval '30 minutes'/);
  assert.match(migration024, /EXISTS \([\s\S]+item_selection_evaluations/);
  assert.match(migration024, /SET status = 'FAILED'/);
  assert.match(migration024, /failure_code = 'STALE_RUN_RECOVERED'/);
  assert.match(migration024, /persisted_evaluation_count = 0/);
  assert.doesNotMatch(migration024, /COMPLETED|PARTIAL/);
});

test("stale recovery is identity-bound, idempotent, audited, and service-role-only", () => {
  assert.match(migration024, /requested_by_principal_id <> p_requested_by_principal_id/);
  assert.match(migration024, /request_fingerprint <> p_expected_request_fingerprint/);
  assert.match(migration024, /v_run\.failure_code = 'STALE_RUN_RECOVERED'[\s\S]+RETURN v_run/);
  assert.match(migration024, /'ITEM_SELECTION_RECONCILE_STALE'/);
  assert.match(migration024, /REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(migration024, /GRANT EXECUTE ON FUNCTION[\s\S]+TO service_role/);
});

test("repository maps only the approved internal reconciliation RPC", () => {
  assert.match(repository, /export async function reconcileStaleItemSelectionRun/);
  assert.match(repository, /client\.rpc\("reconcile_stale_item_selection_run_v1"/);
  assert.match(repository, /p_expected_request_fingerprint: input\.expectedRequestFingerprint/);
  assert.match(repository, /p_requested_by_principal_id: context\.administratorUserId/);
  assert.match(repository, /p_route: "\/internal\/item-selection\/reconcile-stale"/);
  assert.doesNotMatch(repository, /STALE_RUN_RECOVERED/);
});
