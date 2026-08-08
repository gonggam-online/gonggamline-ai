import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createCoupangCategorySnapshot } from "../engines/listing/category-snapshot.ts";
import { bridgeCategorySnapshotToEvidence } from "../engines/listing/category-evidence-bridge.ts";
import { evaluateListingEvidence } from "../engines/listing/evidence-policy.ts";
import { LISTING_EVIDENCE_SCHEMA_VERSION } from "../shared/domain/listing-evidence.ts";

const fixture = JSON.parse(readFileSync(
  path.join(process.cwd(), "tests/fixtures/coupang-category-metadata-contract.json"),
  "utf8",
)) as { response: unknown };

function snapshot(overrides: Partial<Parameters<typeof createCoupangCategorySnapshot>[0]> = {}) {
  return createCoupangCategorySnapshot({
    displayCategoryCode: "78877",
    channel: "MARKETPLACE",
    observedAt: "2026-08-08T00:00:00.000Z",
    evaluatedAt: "2026-08-08T01:00:00.000Z",
    selectedNoticeCategoryName: "기타 재화",
    metadataResponse: fixture.response,
    validityResponse: { code: "SUCCESS", message: "", data: true },
    ...overrides,
  });
}

function bridge(overrides: Partial<Parameters<typeof bridgeCategorySnapshotToEvidence>[0]> = {}) {
  return bridgeCategorySnapshotToEvidence({
    snapshot: snapshot(),
    subjectId: "SYNTHETIC-KK946",
    catalogItemReference: "synthetic:catalog-item:KK946",
    capturedAt: "2026-08-08T01:00:01.000Z",
    evaluatedAt: "2026-08-08T02:00:00.000Z",
    ...overrides,
  });
}

test("validated category snapshot produces one scoped category-contract fact", () => {
  const result = bridge();
  assert.equal(result.disposition, "BRIDGED");
  assert.equal(result.issues.length, 0);
  assert.equal(result.evidenceFact?.field, "coupangCategoryContract");
  assert.equal(result.evidenceFact?.status, "PROVEN");
  assert.equal(result.evidenceFact?.scope, "CATALOG_ITEM");
  assert.match(result.evidenceFact?.evidenceDigest ?? "", /^[a-f0-9]{64}$/);
});

test("bridged fact is admitted by the existing Listing evidence policy", () => {
  const fact = bridge().evidenceFact;
  assert.ok(fact);
  const decision = evaluateListingEvidence({
    schemaVersion: LISTING_EVIDENCE_SCHEMA_VERSION,
    subjectId: fact.subjectId,
    evaluationId: "synthetic-category-evaluation-v1",
    evaluatedAt: "2026-08-08T02:00:00.000Z",
    facts: [fact],
    requiredFields: ["coupangCategoryContract"],
  });
  assert.equal(decision.disposition, "ADMITTED");
});

test("quarantined category snapshot never creates evidence", () => {
  const invalid = snapshot({ validityResponse: { code: "SUCCESS", message: "", data: false } });
  const result = bridge({ snapshot: invalid });
  assert.equal(result.disposition, "QUARANTINED");
  assert.equal(result.evidenceFact, null);
  assert.ok(result.issues.includes("SNAPSHOT_QUARANTINED"));
});

test("notice selection is required before evidence promotion", () => {
  const result = bridge({ snapshot: snapshot({ selectedNoticeCategoryName: null }) });
  assert.equal(result.evidenceFact, null);
  assert.ok(result.issues.includes("NOTICE_SELECTION_REQUIRED"));
});

test("snapshot expiry is reevaluated at bridge time", () => {
  const result = bridge({ evaluatedAt: "2026-08-16T00:00:01.000Z" });
  assert.equal(result.evidenceFact, null);
  assert.ok(result.issues.includes("STALE_SNAPSHOT"));
});

test("bridge identity is bounded and digest is deterministic", () => {
  const first = bridge();
  const retry = bridge();
  assert.deepEqual(first, retry);
  const invalid = bridge({ catalogItemReference: "unsafe reference with spaces" });
  assert.equal(invalid.evidenceFact, null);
  assert.ok(invalid.issues.includes("INVALID_IDENTITY"));
});
