import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessPresalesOpportunity,
  rankPresalesOpportunities,
} from "../shared/domain/presales-opportunity-ranking.ts";
import type { PresalesOpportunityCandidate } from "../shared/domain/presales-opportunity-ranking.ts";

const now = new Date("2026-08-20T12:00:00.000Z");

function candidate(overrides: Partial<PresalesOpportunityCandidate> = {}): PresalesOpportunityCandidate {
  return {
    providerItemNumber: "1001",
    title: "정리 수납 세트",
    category: "생활용품",
    rightsStatus: "UNKNOWN",
    contactable: true,
    complementTags: ["정리"],
    economics: {
      salePrice: null,
      productCost: null,
      inboundCost: null,
      fulfillmentCost: null,
      marketplaceFee: null,
      returnAllowance: null,
    },
    observations: [
      {
        sourceKind: "official_api",
        observedAt: now.toISOString(),
        demandScore: 82,
        growthScore: 75,
        competitionScore: 32,
        supplyScore: 74,
        contentVelocityScore: 70,
        reviewVelocityScore: 65,
        price: 19900,
        confidence: 80,
      },
      {
        sourceKind: "paid_api",
        observedAt: now.toISOString(),
        demandScore: 78,
        growthScore: 72,
        competitionScore: 35,
        supplyScore: 70,
        contentVelocityScore: 68,
        reviewVelocityScore: 62,
        price: 18900,
        confidence: 75,
      },
    ],
    ...overrides,
  };
}

test("presales ranking keeps strong market candidates before economics confirmation", () => {
  const result = assessPresalesOpportunity(candidate(), now);
  assert.equal(result.tier, "PRIORITY_RESEARCH");
  assert.equal(result.market.marginRate, null);
  assert.ok(result.lowerBoundScore !== null);
  assert.ok(result.missingFacts.includes("profitability.unitEconomics"));
  assert.ok(result.missingFacts.includes("rights.publicationGrant"));
});

test("known negative economics or rights failure blocks the candidate", () => {
  const negative = assessPresalesOpportunity(candidate({
    rightsStatus: "PASS",
    economics: { salePrice: 10000, productCost: 9000, inboundCost: 500, fulfillmentCost: 1000, marketplaceFee: 500, returnAllowance: 0 },
  }), now);
  assert.equal(negative.tier, "BLOCKED");
  const rights = assessPresalesOpportunity(candidate({ rightsStatus: "FAIL" }), now);
  assert.equal(rights.tier, "BLOCKED");
});

test("bounded portfolio ranking retains multiple categories instead of one strict winner", () => {
  const results = rankPresalesOpportunities([
    candidate(),
    candidate({ providerItemNumber: "1002", title: "수납 바구니", category: "생활용품" }),
    candidate({ providerItemNumber: "1003", title: "캠핑 정리 세트", category: "캠핑용품" }),
    candidate({ providerItemNumber: "1004", title: "차량 정리 세트", category: "차량용품" }),
  ], 4, now);
  assert.equal(results.length, 4);
  assert.equal(new Set(results.map((result) => result.market.providerItemNumber)).size, 4);
  assert.ok(results.some((result) => result.tier === "PRIORITY_RESEARCH"));
});

