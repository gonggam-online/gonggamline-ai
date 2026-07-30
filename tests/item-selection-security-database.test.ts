import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

interface Fingerprint {
  schemaVersion: string;
  tables: string[];
  type: string;
  functions: string[];
  rlsTables: string[];
  directRolesDenied: string[];
  auditEvents: string[];
}

const root = path.resolve(import.meta.dirname, "..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/021_item_selection_security_vertical_slice.sql"),
  "utf8",
).replaceAll("\r\n", "\n");
const fingerprint = JSON.parse(
  readFileSync(
    path.join(root, "tests/fixtures/item-selection-security-fingerprint.json"),
    "utf8",
  ),
) as Fingerprint;

test("A11: the approved object inventory exactly matches the fingerprint fixture", () => {
  assert.equal(fingerprint.schemaVersion, "gonggamline-item-selection-security-fingerprint-v1");
  assert.deepEqual(fingerprint.tables, [
    "item_selection_evaluations",
    "item_selection_runs",
    "security_audit_events",
  ]);
  assert.equal(fingerprint.type, "item_selection_evaluation_write_v1");
  assert.deepEqual(fingerprint.functions, [
    "create_item_selection_run_v1",
    "finalize_item_selection_run_v1",
  ]);

  const tables = [...migration.matchAll(/CREATE TABLE public\.([a-z_]+)/g)]
    .map((match) => match[1])
    .sort();
  const types = [...migration.matchAll(/CREATE TYPE public\.([a-z0-9_]+)/g)]
    .map((match) => match[1]);
  const functions = [...migration.matchAll(/CREATE FUNCTION public\.([a-z0-9_]+)/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(tables, fingerprint.tables);
  assert.deepEqual(types, [fingerprint.type]);
  assert.deepEqual(functions, fingerprint.functions);
});

test("A06/A11: protected objects default-deny direct Data API access", () => {
  for (const table of fingerprint.rlsTables) {
    assert.match(
      migration,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`),
    );
    assert.match(
      migration,
      new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY;`),
    );
  }
  for (const role of fingerprint.directRolesDenied) {
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON TABLE public\\.[^;]+FROM [^;]*\\b${role}\\b[^;]*;`),
    );
  }
  assert.doesNotMatch(migration, /CREATE POLICY/i);
});

test("A09: each SECURITY DEFINER function writes its audit event in the same function", () => {
  assert.equal(
    (migration.match(/SECURITY DEFINER/g) ?? []).length,
    fingerprint.functions.length,
  );
  for (const event of fingerprint.auditEvents) {
    assert.match(migration, new RegExp(`'${event}'`));
  }
  assert.equal(
    (migration.match(/INSERT INTO public\.security_audit_events/g) ?? []).length,
    2,
  );
});

test("A12: migration 021 contains no remote, linked or Production operation", () => {
  assert.doesNotMatch(migration, /db\s+push|--linked|production|https?:\/\//i);
});
