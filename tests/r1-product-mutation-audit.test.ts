import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const audit = JSON.parse(
  readFileSync(
    path.join(root, "docs", "security", "r1-product-mutation-audit.json"),
    "utf8",
  ),
) as {
  schemaVersion: string;
  implementationAuthorized: boolean;
  surfaces: Array<{
    route: string;
    method: string;
    operation: string;
    currentAuthentication: string;
    currentCsrf: string;
    currentIdempotency: string;
    currentAudit: string;
    requiredChange: string;
    risk: string[];
  }>;
  stopConditions: string[];
};

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("audit fixes the complete externally reachable Product mutation inventory", () => {
  assert.equal(audit.schemaVersion, "gonggamline-r1-product-mutation-audit-v1");
  assert.deepEqual(
    audit.surfaces.map(({ method, route }) => `${method} ${route}`).sort(),
    [
      "GET /api/domeggook-search",
      "PATCH /api/products/[id]",
      "POST /api/competition/analyze-batch",
      "POST /api/products/[id]/competition",
      "POST /api/products/[id]/competition/auto",
    ],
  );
});

test("audit remains aligned with Product mutation source evidence", () => {
  assert.match(source("app/api/domeggook-search/route.ts"), /export async function GET/);
  assert.doesNotMatch(source("app/api/domeggook-search/route.ts"), /saveProducts\(/);
  assert.match(source("app/api/admin/products/import/route.ts"), /importProduct\(/);
  assert.match(source("app/api/products/[id]/route.ts"), /export async function PATCH/);
  assert.match(source("app/api/products/[id]/route.ts"), /patchProductOperatorFields\(/);
  assert.match(source("app/api/products/[id]/competition/route.ts"), /export async function POST/);
  assert.match(source("app/api/products/[id]/competition/route.ts"), /recordProductCompetition\(/);
  assert.match(source("app/api/products/[id]/competition/auto/route.ts"), /runAutomaticCompetitionAnalysis/);
  assert.match(source("app/api/competition/analyze-batch/route.ts"), /runAutomaticCompetitionAnalysis/);
  assert.match(source("features/competition/run-analysis.ts"), /recordProductCompetition\(/);
});

test("audit records fail-closed prerequisites and grants no implementation authority", () => {
  assert.equal(audit.implementationAuthorized, false);
  assert.ok(audit.stopConditions.length >= 5);
  for (const surface of audit.surfaces) {
    assert.equal(surface.currentAuthentication, "none");
    assert.ok(surface.operation.length > 0);
    assert.ok(surface.currentCsrf.length > 0);
    assert.ok(surface.currentIdempotency.length > 0);
    assert.ok(surface.currentAudit.length > 0);
    assert.ok(surface.requiredChange.length > 0);
    assert.ok(surface.risk.length > 0);
  }
});
