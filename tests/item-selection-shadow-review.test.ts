import assert from "node:assert/strict";
import test from "node:test";

import {
  buildItemSelectionShadowReview,
  ITEM_SELECTION_SHADOW_REVIEW_VERSION,
} from "../shared/domain/item-selection-shadow-review.ts";

const input = {
  providerItemNumber: "12345",
  currentVerdict: "MANUAL_REVIEW" as const,
  currentScore: 41,
  profitabilityStatus: "CONFIRMED" as const,
  contributionMarginRate: 0.24,
  rightsStatus: "PASS" as const,
  market: {
    observedAt: "2026-08-19T00:00:00.000Z",
    source: "manual" as const,
    opportunityScore: 95,
    demandScore: 95,
    growthScore: 95,
    competitionScore: 10,
    supplyScore: 95,
    adBurdenScore: 5,
    entryDifficultyScore: 10,
    confidence: 95,
    dataCompletenessScore: 100,
    estimatedUnitsBase: 120,
  },
};

test("keeps the live verdict unchanged while exposing a review-only shadow result", () => {
  const packet = buildItemSelectionShadowReview(input, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(packet.version, ITEM_SELECTION_SHADOW_REVIEW_VERSION);
  assert.equal(packet.currentVerdict, "MANUAL_REVIEW");
  assert.equal(packet.currentScore, 41);
  assert.equal(packet.operationalVerdictChanged, false);
  assert.equal(packet.requiresManualReview, true);
  assert.equal(packet.shadow.decision, "PRIORITIZE_FOR_REVIEW");
});

test("keeps incomplete or uncleared evidence out of operational recommendations", () => {
  const packet = buildItemSelectionShadowReview({
    ...input,
    profitabilityStatus: "INCOMPLETE",
    rightsStatus: "UNKNOWN",
    market: { ...input.market, demandScore: null },
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(packet.operationalVerdictChanged, false);
  assert.equal(packet.shadow.decision, "DO_NOT_PRIORITIZE");
  assert.equal(packet.shadow.eligibility, "INSUFFICIENT_DATA");
  assert(packet.shadow.missingFacts.includes("rights.pass"));
});
