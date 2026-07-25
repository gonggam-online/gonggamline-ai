import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateRevenue } from "../lib/revenue/calculation.ts";
import {
  REVENUE_SCORE_WEIGHTS,
  attachRevenueScores,
  calculateProductRevenueScore,
  calculateRevenueScore,
  normalizeCompetition,
  normalizeMargin,
  normalizeProfit,
  normalizeSearchDemand,
  type RevenueScoreInput,
} from "../lib/revenue/score.ts";

const readyCalculation = calculateRevenue({
  unitSellingPrice: 20_000,
  unitProductCost: 8_000,
  unitPlatformFee: 2_000,
  unitAdvertisingCost: 1_000,
  unitLogisticsCost: 2_000,
  unitOtherCost: 1_000,
  estimatedSalesLow: 50,
  estimatedSalesBase: 100,
  estimatedSalesHigh: 150,
});

const completeScoreInput: RevenueScoreInput = {
  revenueCalculation: readyCalculation,
  monthlySearchVolume: 10_000,
  competitionScore: 20,
  competitionStatus: "analyzed",
  competitionSource: "external",
  competitionConfidence: 100,
  supplyStabilityScore: 90,
};

test("weights are separated constants and total one", () => {
  const total = Object.values(REVENUE_SCORE_WEIGHTS).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  assert.equal(total, 1);
});

test("profit normalization clamps the lower boundary", () => {
  assert.equal(normalizeProfit(-1), 0);
});

test("profit normalization reaches 100 at one million won", () => {
  assert.equal(normalizeProfit(1_000_000), 100);
  assert.equal(normalizeProfit(2_000_000), 100);
});

test("margin normalization maps 20 percent to 50", () => {
  assert.equal(normalizeMargin(20), 50);
});

test("margin normalization clamps negative and above-target values", () => {
  assert.equal(normalizeMargin(-10), 0);
  assert.equal(normalizeMargin(80), 100);
});

test("search demand normalization handles zero and maximum", () => {
  assert.equal(normalizeSearchDemand(0), 0);
  assert.equal(normalizeSearchDemand(100_000), 100);
});

test("search demand uses logarithmic rather than linear scaling", () => {
  assert.equal(normalizeSearchDemand(100), 40.1);
  assert.ok(normalizeSearchDemand(1_000) > normalizeSearchDemand(100));
});

test("competition normalization rewards lower competition", () => {
  assert.equal(normalizeCompetition(0), 100);
  assert.equal(normalizeCompetition(100), 0);
});

test("complete data returns an explainable bounded score", () => {
  const result = calculateRevenueScore(completeScoreInput);
  assert.equal(result.status, "ready");
  assert.ok(result.revenueScore !== null);
  assert.ok(result.revenueScore >= 0 && result.revenueScore <= 100);
  assert.equal(result.scoreBreakdown.profit.score, 60);
  assert.equal(result.scoreBreakdown.competition.score, 80);
  assert.deepEqual(result.missingFactors, []);
});

test("configured weights produce the expected weighted average", () => {
  const result = calculateRevenueScore(completeScoreInput);
  assert.equal(result.revenueScore, 75);
});

test("missing supply stability excludes and redistributes its weight", () => {
  const { supplyStabilityScore: _supply, ...input } = completeScoreInput;
  const result = calculateRevenueScore(input);
  assert.equal(result.scoreBreakdown.supplyStability.score, null);
  assert.equal(result.scoreBreakdown.supplyStability.appliedWeight, 0);
  const appliedTotal = Object.values(result.scoreBreakdown).reduce(
    (sum, factor) => sum + factor.appliedWeight,
    0,
  );
  assert.ok(Math.abs(appliedTotal - 1) < 0.001);
  assert.deepEqual(result.missingFactors, ["supplyStability"]);
});

test("missing required demand returns incomplete and lowers confidence", () => {
  const { monthlySearchVolume: _demand, ...input } = completeScoreInput;
  const result = calculateRevenueScore(input);
  assert.equal(result.status, "incomplete");
  assert.ok(result.confidence < 1);
  assert.ok(result.missingFactors.includes("searchDemand"));
});

test("invalid competition is missing instead of silently clamped", () => {
  const result = calculateRevenueScore({
    ...completeScoreInput,
    competitionScore: 101,
  });
  assert.equal(result.scoreBreakdown.competition.score, null);
  assert.equal(result.status, "incomplete");
});

test("estimated revenue sales lower status and confidence", () => {
  const estimatedCalculation = calculateRevenue({
    unitSellingPrice: 20_000,
    unitProductCost: 8_000,
    unitPlatformFee: 2_000,
    unitAdvertisingCost: 1_000,
    unitLogisticsCost: 2_000,
    unitOtherCost: 1_000,
    estimatedSalesLow: 50,
    estimatedSalesHigh: 150,
  });
  const result = calculateRevenueScore({
    ...completeScoreInput,
    revenueCalculation: estimatedCalculation,
  });
  assert.equal(result.status, "estimated");
  assert.ok(result.confidence < 1);
  assert.match(result.assumptions.join(" "), /estimated base sales/);
});

test("estimated competition lowers confidence independently", () => {
  const result = calculateRevenueScore({
    ...completeScoreInput,
    competitionStatus: "estimated",
    competitionSource: "estimated",
  });
  assert.equal(result.status, "estimated");
  assert.equal(result.confidence, 0.8);
});

test("stored competition confidence scales overall confidence", () => {
  const result = calculateRevenueScore({
    ...completeScoreInput,
    competitionConfidence: 50,
  });
  assert.equal(result.confidence, 0.5);
});

test("invalid Revenue Calculation produces an invalid score state", () => {
  const invalidCalculation = calculateRevenue({
    unitSellingPrice: 0,
    unitProductCost: 1,
    unitPlatformFee: 1,
    unitAdvertisingCost: 1,
    unitLogisticsCost: 1,
    unitOtherCost: 1,
    estimatedSalesLow: 1,
    estimatedSalesHigh: 2,
  });
  const result = calculateRevenueScore({
    ...completeScoreInput,
    revenueCalculation: invalidCalculation,
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.revenueScore, null);
  assert.equal(result.confidence, 0);
  assert.equal(result.scoreBreakdown.profit.score, null);
  assert.equal(result.scoreBreakdown.margin.score, null);
});

test("no calculable required factors returns a null score", () => {
  const incompleteCalculation = calculateRevenue({
    unitSellingPrice: null,
    unitProductCost: null,
    unitPlatformFee: null,
    unitAdvertisingCost: null,
    unitLogisticsCost: null,
    unitOtherCost: null,
    estimatedSalesLow: null,
    estimatedSalesHigh: null,
  });
  const result = calculateRevenueScore({
    revenueCalculation: incompleteCalculation,
  });
  assert.equal(result.revenueScore, null);
  assert.equal(result.confidence, 0);
});

test("product mapper reuses stored Revenue and Competition fields", () => {
  const result = calculateProductRevenueScore({
    estimated_sale_price: 20_000,
    supply_price: 8_000,
    marketplace_fee: 2_000,
    advertising_cost: 1_000,
    logistics_cost: 2_000,
    return_reserve: 1_000,
    estimated_monthly_units_low: 50,
    estimated_monthly_units_high: 150,
    coupang_keyword_search_volume: 10_000,
    competition_score: 20,
    competition_analysis_status: "analyzed",
    competition_data_source: "external",
    competition_confidence: 90,
  });
  assert.equal(result.status, "estimated");
  assert.equal(result.scoreBreakdown.profit.score, 60);
  assert.equal(result.scoreBreakdown.searchDemand.score, 80);
  assert.ok(result.missingFactors.includes("supplyStability"));
});

test("attachment helper preserves product fields without mutation", () => {
  const products = [{ id: 7, title: "test" }];
  const mapped = attachRevenueScores(products);
  assert.equal(mapped[0].id, 7);
  assert.ok(Object.hasOwn(mapped[0], "revenueScore"));
  assert.equal(Object.hasOwn(products[0], "revenueScore"), false);
});

test("Product API exposes Revenue Score only behind its opt-in query", () => {
  const route = readFileSync("app/api/products/route.ts", "utf8");
  assert.match(
    route,
    /params\.get\("includeRevenueScore"\) === "true"/,
  );
  assert.match(route, /if \(includeRevenueScore\)/);
  assert.match(route, /attachRevenueScores\(products\)/);
});
