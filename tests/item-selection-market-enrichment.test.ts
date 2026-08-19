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
  assert.equal(result.demand.normalizedScore, 60);
  assert.equal(result.conversionPotential.status, "UNAVAILABLE");
});
