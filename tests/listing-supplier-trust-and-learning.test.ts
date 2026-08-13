import assert from "node:assert/strict";
import test from "node:test";
import { admitTrustedSupplierObservations, evaluateSupplierTrustChange } from "../engines/listing/supplier-trust.ts";
import { evaluateSequentialRevision } from "../engines/listing/learning.ts";
import { findApprovedSupplierTrustProfile } from "../engines/listing/approved-supplier-profiles.ts";
import { createCoupangMarketplacePolicySnapshotV20260813 } from "../engines/listing/marketplace-policy.ts";
import type { ApprovedSupplierTrustProfile } from "../shared/domain/supplier-trust.ts";

const profile: ApprovedSupplierTrustProfile = { profileId: "fixture-approved-wholesale", sourceId: "fixture-wholesale", version: "2026-08-13.v1", status: "ACTIVE", effectiveAt: "2026-08-13T00:00:00.000Z", capabilityDigest: "a".repeat(64), supersedesVersion: null, allowedFactFields: ["productName", "option", "manufacturer", "origin", "transactionPrice"], capabilities: { publicProductFacts: true, accountProductFacts: true, transactionTerms: true, options: true, manufacturerAndOrigin: true }, originalImageUse: "VERIFIED", imageEditRights: "UNKNOWN", allowedChannels: ["COUPANG"] };

test("Domeggook allowlist profile versions unchanged-use separately from edit rights", () => {
  const approved = findApprovedSupplierTrustProfile("domeggook");
  assert.ok(approved);
  assert.equal(approved.originalImageUse, "VERIFIED");
  assert.equal(approved.imageEditRights, "UNKNOWN");
  assert.match(approved.version, /^2026-08-13\./);
  assert.match(approved.capabilityDigest, /^[a-f0-9]{64}$/);
});

test("cold-start policy snapshot records exact source priority, URL, date, scope and limitation", () => {
  const snapshot = createCoupangMarketplacePolicySnapshotV20260813();
  assert.match(snapshot.digest, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.keywordMaxCount, 20);
  assert.equal(snapshot.keywordMaxLength, 20);
  assert.equal(snapshot.mainImageRecommendedPixels, 1000);
  assert.equal(snapshot.additionalImageMaxCount, 9);
  assert.deepEqual(snapshot.allowedImageMimeTypes, ["image/jpeg", "image/png"]);
  assert.equal(snapshot.imageMaxByteSize, 10_000_000);
  assert.ok(snapshot.sources.filter(({ kind }) => kind === "COUPANG_OFFICIAL").length >= 5);
  assert.ok(snapshot.sources.some(({ url }) => url === "https://support.google.com/merchants/answer/7380908?hl=en"));
  assert.ok(snapshot.sources.some(({ url }) => url === "https://baymard.com/blog/product-images-descriptive-text"));
  assert.ok(snapshot.sources.every(({ url, observedAt, appliesTo, limitation, digest }) => url.startsWith("https://") && observedAt.startsWith("2026-08-13") && appliesTo.length > 0 && limitation.length > 0 && /^[a-f0-9]{64}$/.test(digest)));
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

test("trust profile capability reduction identifies affected facts and assets", () => {
  const result = evaluateSupplierTrustChange(profile, { ...profile, version: "2026-08-14.v2", supersedesVersion: profile.version, allowedFactFields: ["productName"], originalImageUse: "UNKNOWN" });
  assert.equal(result.required, true);
  assert.equal(result.assetsAffected, true);
  assert.ok(result.affectedFields.includes("manufacturer"));
  assert.deepEqual(result.reasons, ["CAPABILITY_REDUCED", "IMAGE_RIGHTS_REDUCED"]);
});

test("sequential learning never declares a winner from CTR or CVR alone", () => {
  const base = { packetId: "packet-1", recordedAt: "2026-08-08T00:00:00.000Z", observedFrom: "2026-08-01", observedTo: "2026-08-07", impressions: 1000, clicks: 200, orders: 100, cancellations: 0, returns: 0, refunds: 0, settlementAmount: 100000, attributableProfit: 10000 };
  const decision = evaluateSequentialRevision([{ ...base, eventId: "event-1", revisionId: "r1", variantId: "A" }, { ...base, eventId: "event-2", revisionId: "r2", variantId: "B", attributableProfit: -1 }], 500, 0.1);
  assert.equal(decision.winnerDeclared, false);
  assert.equal(decision.status, "GUARDRAIL_FAILED");
  assert.ok(decision.reasons.includes("ATTRIBUTABLE_PROFIT_GUARDRAIL_FAILED"));
  assert.equal(decision.performance[0].clickThroughRate, 0.2);
  assert.equal(decision.performance[0].conversionRate, 0.5);
});

test("sequential learning applies cancellation and return guardrails before human review", () => {
  const base = { packetId: "packet-2", recordedAt: "2026-08-08T00:00:00.000Z", observedFrom: "2026-08-01", observedTo: "2026-08-07", impressions: 1000, clicks: 200, orders: 100, cancellations: 25, returns: 0, refunds: 0, settlementAmount: 100000, attributableProfit: 10000 };
  const decision = evaluateSequentialRevision([{ ...base, eventId: "event-3", revisionId: "r3", variantId: "A" }, { ...base, eventId: "event-4", revisionId: "r4", variantId: "B", cancellations: 0, returns: 11 }], 500, 0.1, 0.2);
  assert.equal(decision.winnerDeclared, false);
  assert.equal(decision.status, "GUARDRAIL_FAILED");
  assert.ok(decision.reasons.includes("CANCELLATION_GUARDRAIL_FAILED"));
  assert.ok(decision.reasons.includes("RETURN_GUARDRAIL_FAILED"));
});
