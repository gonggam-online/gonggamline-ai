import assert from "node:assert/strict";
import test from "node:test";
import { admitTrustedSupplierObservations } from "../engines/listing/supplier-trust.ts";
import { evaluateSequentialRevision } from "../engines/listing/learning.ts";
import { findApprovedSupplierTrustProfile } from "../engines/listing/approved-supplier-profiles.ts";
import type { ApprovedSupplierTrustProfile } from "../shared/domain/supplier-trust.ts";

const profile: ApprovedSupplierTrustProfile = { profileId: "fixture-approved-wholesale", sourceId: "fixture-wholesale", version: "2026-08-13.v1", status: "ACTIVE", effectiveAt: "2026-08-13T00:00:00.000Z", allowedFactFields: ["productName", "option", "manufacturer", "origin", "transactionPrice"], originalImageUse: "VERIFIED", imageEditRights: "UNKNOWN", allowedChannels: ["COUPANG"] };

test("Domeggook allowlist profile versions unchanged-use separately from edit rights", () => {
  const approved = findApprovedSupplierTrustProfile("domeggook");
  assert.ok(approved);
  assert.equal(approved.originalImageUse, "VERIFIED");
  assert.equal(approved.imageEditRights, "UNKNOWN");
  assert.match(approved.version, /^2026-08-13\./);
});

test("approved supplier trust profile auto-admits allowed facts with provenance", () => {
  const result = admitTrustedSupplierObservations(profile, [{ observationId: "obs-1", subjectId: "SYNTHETIC-02", field: "manufacturer", value: "Fixture Maker", sourceId: "fixture-wholesale", sourceReference: "fixture:catalog:02", evidenceDigest: "a".repeat(64), observedAt: "2026-08-12T00:00:00.000Z", capturedAt: "2026-08-12T00:01:00.000Z" }], "2026-08-13T00:00:00.000Z");
  assert.equal(result.facts[0].status, "PROVEN");
  assert.match(result.facts[0].sourceReference, /trust=2026-08-13\.v1/);
  assert.equal(result.warnings.length, 0);
});

test("trust profile freshness is warning-only while revocation forces reevaluation", () => {
  const observation = { observationId: "obs-1", subjectId: "SYNTHETIC-02", field: "origin", value: "대한민국", sourceId: "fixture-wholesale", sourceReference: "fixture:catalog:02", evidenceDigest: "a".repeat(64), observedAt: "2025-01-01T00:00:00.000Z", capturedAt: "2025-01-01T00:01:00.000Z" };
  assert.ok(admitTrustedSupplierObservations(profile, [observation], "2026-08-13T00:00:00.000Z").warnings.some(({ code }) => code === "FRESHNESS_WARNING"));
  const revoked = admitTrustedSupplierObservations({ ...profile, status: "REVOKED" }, [observation], "2026-08-13T00:00:00.000Z");
  assert.equal(revoked.facts[0].status, "PROHIBITED");
  assert.ok(revoked.warnings.some(({ code }) => code === "TRUST_PROFILE_REVIEW_REQUIRED"));
});

test("sequential learning never declares a winner from CTR or CVR alone", () => {
  const base = { observedFrom: "2026-08-01", observedTo: "2026-08-07", impressions: 1000, clicks: 200, orders: 100, cancellations: 0, returns: 0, refunds: 0, settlementAmount: 100000, attributableProfit: 10000 };
  const decision = evaluateSequentialRevision([{ ...base, revisionId: "r1", variantId: "A" }, { ...base, revisionId: "r2", variantId: "B", attributableProfit: -1 }], 500, 0.1);
  assert.equal(decision.winnerDeclared, false);
  assert.equal(decision.status, "GUARDRAIL_FAILED");
  assert.ok(decision.reasons.includes("ATTRIBUTABLE_PROFIT_GUARDRAIL_FAILED"));
});
