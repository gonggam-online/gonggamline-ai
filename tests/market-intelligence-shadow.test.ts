import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateMarketIntelligenceShadow,
  MARKET_INTELLIGENCE_SHADOW_VERSION,
  type MarketIntelligenceShadowInput,
} from "../shared/domain/market-intelligence-shadow.ts";

const base: MarketIntelligenceShadowInput = {
  providerItemNumber: "12345",
  market: {
    observedAt: "2026-08-19T00:00:00.000Z",
    source: "manual",
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
  profitabilityStatus: "CONFIRMED",
  contributionMarginRate: 0.24,
  rightsStatus: "PASS",
};

test("uses deterministic evidence-weighted scoring for a fresh complete candidate", () => {
  const first = evaluateMarketIntelligenceShadow(base, new Date("2026-08-19T12:00:00.000Z"));
  const second = evaluateMarketIntelligenceShadow(base, new Date("2026-08-19T12:00:00.000Z"));
  assert.deepEqual(first, second);
  assert.equal(first.version, MARKET_INTELLIGENCE_SHADOW_VERSION);
  assert.equal(first.eligibility, "SHADOW_CANDIDATE");
  assert.equal(first.decision, "PRIORITIZE_FOR_REVIEW");
  assert(first.confidenceAdjustedScore !== null && first.confidenceAdjustedScore >= 65);
});

test("never invents a competitive score when a core market fact is missing", () => {
  const result = evaluateMarketIntelligenceShadow({
    ...base,
    market: { ...base.market, demandScore: null },
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.eligibility, "INSUFFICIENT_DATA");
  assert.equal(result.marketScore, null);
  assert(result.missingFacts.includes("market.demandScore"));
});

test("stale evidence reduces confidence and cannot be prioritized", () => {
  const result = evaluateMarketIntelligenceShadow({
    ...base,
    market: { ...base.market, observedAt: "2026-01-01T00:00:00.000Z" },
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.freshnessScore, 0);
  assert.notEqual(result.decision, "PRIORITIZE_FOR_REVIEW");
});

test("rights failure blocks a high-scoring candidate", () => {
  const result = evaluateMarketIntelligenceShadow({ ...base, rightsStatus: "FAIL" });
  assert.equal(result.eligibility, "BLOCKED");
  assert.equal(result.decision, "DO_NOT_PRIORITIZE");
  assert.equal(result.riskScore, 100);
});
