import assert from "node:assert/strict";
import test from "node:test";

import { analyzeMarketOpportunity, proposeProductConfigurations } from "../shared/domain/market-opportunity-analysis.ts";

const observation = {
  sourceKind: "official_api" as const,
  observedAt: "2026-08-19T00:00:00.000Z",
  demandScore: 80,
  growthScore: 75,
  competitionScore: 35,
  supplyScore: 82,
  contentVelocityScore: 70,
  reviewVelocityScore: 68,
  price: 19900,
  confidence: 90,
};

test("combines multi-source market evidence with complete unit economics", () => {
  const result = analyzeMarketOpportunity({
    providerItemNumber: "100",
    title: "정리용품",
    category: "생활용품",
    observations: [observation, { ...observation, sourceKind: "short_video_public", confidence: 70 }],
    economics: { salePrice: 19900, productCost: 4000, inboundCost: 500, fulfillmentCost: 3000, marketplaceFee: 2090, returnAllowance: 600 },
    complementTags: ["organization"],
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.status, "ACTIONABLE");
  assert.ok(result.marketScore !== null && result.marketScore >= 55);
  assert.ok(result.marginRate !== null && result.marginRate > 0.15);
});

test("does not discard promising market demand when cost evidence is incomplete", () => {
  const result = analyzeMarketOpportunity({
    providerItemNumber: "101",
    title: "수납 보조용품",
    category: "생활용품",
    observations: [observation],
    economics: { salePrice: null, productCost: null, inboundCost: null, fulfillmentCost: null, marketplaceFee: null, returnAllowance: null },
    complementTags: ["organization"],
  }, new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(result.status, "COST_CONFIRMATION_REQUIRED");
  assert.ok(result.missingFacts.includes("profitability.unitEconomics"));
});

test("proposes single and complementary set configurations", () => {
  const inputs = [
    { providerItemNumber: "100", title: "정리함", category: null, observations: [observation], economics: { salePrice: 10000, productCost: 2000, inboundCost: 500, fulfillmentCost: 2000, marketplaceFee: 1000, returnAllowance: 300 }, complementTags: ["organization"] },
    { providerItemNumber: "101", title: "라벨기", category: null, observations: [observation], economics: { salePrice: 12000, productCost: 3000, inboundCost: 500, fulfillmentCost: 2000, marketplaceFee: 1200, returnAllowance: 300 }, complementTags: ["organization"] },
  ];
  const result = proposeProductConfigurations(inputs, new Date("2026-08-19T12:00:00.000Z"));
  assert.ok(result.some((item) => item.type === "SINGLE"));
  assert.ok(result.some((item) => item.type === "SET"));
});
