import assert from "node:assert/strict";
import test from "node:test";

import { enrichItemSelectionScores } from "../shared/domain/item-selection-market-enrichment.ts";
import type { ItemSelectionScoreInputs } from "../shared/domain/item-selection.ts";

const empty: ItemSelectionScoreInputs = {
  competitiveness: { status: "UNAVAILABLE", missingFacts: ["competitionAnalysis"] },
  profitability: { status: "UNAVAILABLE", missingFacts: ["completeProfitability"] },
  demand: { status: "UNAVAILABLE", missingFacts: ["measuredDemand"] },
  conversionPotential: { status: "UNAVAILABLE", missingFacts: ["conversionEvidence"] },
  logisticsFit: { status: "UNAVAILABLE", missingFacts: ["logisticsEvidence"] },
  supplyStability: { status: "UNAVAILABLE", missingFacts: ["longitudinalSupplyEvidence"] },
};

test("maps exact market metrics into existing score areas", () => {
  const result = enrichItemSelectionScores(empty, {
    opportunityScore: 82,
    demandScore: 77,
    growthScore: 64,
    supplyScore: 71,
    confidence: 88,
  });
  assert.equal(result.competitiveness.status, "AVAILABLE");
  assert("normalizedScore" in result.competitiveness);
  assert("normalizedScore" in result.demand);
  assert("normalizedScore" in result.supplyStability);
  assert.equal(result.competitiveness.normalizedScore, 82);
  assert.equal(result.demand.normalizedScore, 77);
  assert.equal(result.supplyStability.normalizedScore, 88);
  assert.equal(result.profitability.status, "UNAVAILABLE");
});

test("does not invent scores for missing market facts", () => {
  const result = enrichItemSelectionScores(empty, {
    opportunityScore: null,
    demandScore: 60,
    growthScore: null,
    supplyScore: null,
    confidence: null,
  });
  assert.equal(result.competitiveness.status, "UNAVAILABLE");
  assert("normalizedScore" in result.demand);
  assert.equal(result.demand.normalizedScore, 60);
  assert.equal(result.conversionPotential.status, "UNAVAILABLE");
});

test("preserves a digest-bound autonomous trend reference in every available score", () => {
  const evidence = [{ sourceType: "AUTONOMOUS_MARKET_TREND", sourceField: "output.trends", summary: "시장 트렌드", observedAt: "2026-08-26T00:00:00.000Z", reference: `sha256:${"a".repeat(64)}` }];
  const result = enrichItemSelectionScores(empty, {
    opportunityScore: 74,
    demandScore: 70,
    growthScore: 68,
    supplyScore: null,
    confidence: 66,
    evidence,
  });
  assert.equal(result.competitiveness.status, "AVAILABLE");
  if (result.competitiveness.status === "AVAILABLE") assert.deepEqual(result.competitiveness.evidence, evidence);
  assert.equal(result.logisticsFit.status, "UNAVAILABLE");
});
