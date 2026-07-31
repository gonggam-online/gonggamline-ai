import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const matrixPath = path.join(
  repositoryRoot,
  "docs",
  "security",
  "production-access-matrix-v1.json",
);

const validClasses = new Set([
  "PUBLIC_READ",
  "AUTHENTICATED_READ",
  "SERVER_ONLY",
  "ADMIN_MUTATION",
  "WORKER_MUTATION",
  "DORMANT_DENY",
]);

interface AccessGroup {
  id: string;
  tables: string[];
  readClass: string;
  writeClasses: string[];
  currentPrincipal: string;
  targetPrincipal: string;
  consumerEvidence: string[];
  operations: string[];
  columns: string;
  idempotency: string;
  audit: string;
  failure: string;
  transitionStatus: string;
}

interface AccessMatrix {
  schemaVersion: string;
  decision: string;
  inventoryScope: {
    expectedPublicTableCount: number;
    productionObservedTableCount: number;
    productionMissingTables: string[];
  };
  groups: AccessGroup[];
  sqlGenerationGate: {
    allowed: boolean;
    blockedUntil: string[];
  };
}

const matrix = JSON.parse(readFileSync(matrixPath, "utf8")) as AccessMatrix;

function migrationTables(): string[] {
  const directory = path.join(repositoryRoot, "supabase", "migrations");
  const tables = readdirSync(directory)
    .filter((name) => /^(?:00[0-9]|01[0-9]|020|021)_.+\.sql$/.test(name))
    .flatMap((name) => {
      const sql = readFileSync(path.join(directory, name), "utf8");
      return [...sql.matchAll(/create table(?: if not exists)? public\.([a-z0-9_]+)/gi)]
        .map((match) => match[1]);
    });
  return [...new Set(tables)].sort();
}

test("access matrix covers every migration 000-021 public table exactly once", () => {
  const assigned = matrix.groups.flatMap(({ tables }) => tables);
  assert.equal(assigned.length, matrix.inventoryScope.expectedPublicTableCount);
  assert.equal(new Set(assigned).size, assigned.length, "table assignments must be unique");
  assert.deepEqual([...assigned].sort(), migrationTables());
});

test("each access group is default-deny compatible and has write-path evidence", () => {
  for (const group of matrix.groups) {
    assert.ok(group.id.length > 0);
    assert.ok(group.tables.length > 0);
    assert.ok(validClasses.has(group.readClass), `${group.id} read class`);
    assert.ok(group.writeClasses.length > 0);
    for (const accessClass of group.writeClasses) {
      assert.ok(validClasses.has(accessClass), `${group.id} write class`);
    }
    for (const field of [
      group.currentPrincipal,
      group.targetPrincipal,
      group.columns,
      group.idempotency,
      group.audit,
      group.failure,
      group.transitionStatus,
    ]) {
      assert.ok(field.trim().length > 0, `${group.id} has incomplete evidence`);
    }
    if (!group.writeClasses.includes("DORMANT_DENY")) {
      assert.ok(group.operations.length > 0, `${group.id} must list operations`);
      assert.ok(group.consumerEvidence.length > 0, `${group.id} must list consumers`);
    }
  }
});

test("known Production drift and migration 021 absence stay explicit", () => {
  const dormant = matrix.groups.find(({ id }) => id === "dormant-commerce-os");
  assert.deepEqual(dormant?.writeClasses, ["DORMANT_DENY"]);
  assert.equal(dormant?.tables.length, 6);

  const product = matrix.groups.find(({ id }) => id === "product-catalog");
  assert.equal(product?.readClass, "PUBLIC_READ");
  assert.deepEqual(product?.writeClasses, ["ADMIN_MUTATION"]);
  assert.equal(product?.transitionStatus, "BLOCKED_R1");

  assert.equal(matrix.inventoryScope.productionObservedTableCount, 57);
  assert.deepEqual(matrix.inventoryScope.productionMissingTables.sort(), [
    "item_selection_evaluations",
    "item_selection_runs",
    "security_audit_events",
  ]);
});

test("R0 cannot authorize reconciliation SQL", () => {
  assert.equal(matrix.schemaVersion, "gonggamline-production-access-matrix-v1");
  assert.equal(matrix.decision, "default-deny");
  assert.equal(matrix.sqlGenerationGate.allowed, false);
  assert.ok(matrix.sqlGenerationGate.blockedUntil.length >= 4);
});
