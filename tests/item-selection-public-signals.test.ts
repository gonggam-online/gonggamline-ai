import assert from "node:assert/strict";
import test from "node:test";

import { publicCatalogOpportunityScores } from "../shared/domain/item-selection-public-signals.ts";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog.ts";
import { COUPANG_MARKET_PRICE_ESTIMATE_VERSION } from "../shared/domain/coupang-market-price.ts";

function item(overrides: Partial<SupplierCatalogItem> = {}): SupplierCatalogItem {
  return {
    provider: "domeggook",
    providerItemId: "1001",
    name: "공개 상품",
    supplierPriceKrw: 5_000,
    shippingFeeKrw: 3_000,
    minimumOrderQuantity: 1,
    stockStatus: "in_stock",
    thumbnailUrl: "https://example.com/thumb.jpg",
    productUrl: "https://example.com/1001",
    supplierId: "supplier-1",
    supplierName: "공급처",
    availableOnDomeggook: true,
    supplyAvailable: true,
    ...overrides,
  };
}

test("every public catalogue result receives a deterministic opportunity score", () => {
  const cohort = [
    item(),
    item({ providerItemId: "1002", supplierPriceKrw: 10_000 }),
  ];
  const first = publicCatalogOpportunityScores(
    cohort[0]!,
    cohort,
    0,
    "2026-08-25T00:00:00.000Z",
  );
  const repeated = publicCatalogOpportunityScores(
    cohort[0]!,
    cohort,
    0,
    "2026-08-25T00:00:00.000Z",
  );

  assert.deepEqual(first, repeated);
  assert.equal(first.profitability.status, "AVAILABLE");
  for (const area of ["competitiveness", "profitability", "demand", "conversionPotential", "logisticsFit", "supplyStability"] as const) {
    assert.equal(first[area].status, "AVAILABLE");
    assert.equal(first[area].evidence[0]?.sourceType, "PUBLIC_SUPPLIER_CATALOG");
  }
});

test("lower required selling-price floor ranks above a higher-cost candidate", () => {
  const cheaper = item({ providerItemId: "1001", supplierPriceKrw: 4_000 });
  const expensive = item({ providerItemId: "1002", supplierPriceKrw: 12_000 });
  const cohort = [cheaper, expensive];
  const cheapScore = publicCatalogOpportunityScores(cheaper, cohort, 0, "2026-08-25T00:00:00.000Z");
  const expensiveScore = publicCatalogOpportunityScores(expensive, cohort, 1, "2026-08-25T00:00:00.000Z");
  assert.equal(cheapScore.profitability.status, "AVAILABLE");
  assert.equal(expensiveScore.profitability.status, "AVAILABLE");
  assert(cheapScore.profitability.normalizedScore > expensiveScore.profitability.normalizedScore);
});

test("lower comparable landed cost ranks above a higher-cost cohort item", () => {
  const cheaper = item({ providerItemId: "1001", supplierPriceKrw: 4_000 });
  const expensive = item({ providerItemId: "1002", supplierPriceKrw: 12_000 });
  const cohort = [cheaper, expensive];
  const cheapScore = publicCatalogOpportunityScores(cheaper, cohort, 0, "2026-08-25T00:00:00.000Z");
  const expensiveScore = publicCatalogOpportunityScores(expensive, cohort, 1, "2026-08-25T00:00:00.000Z");

  assert.equal(cheapScore.competitiveness.status, "AVAILABLE");
  assert.equal(expensiveScore.competitiveness.status, "AVAILABLE");
  assert(cheapScore.competitiveness.normalizedScore > expensiveScore.competitiveness.normalizedScore);
});

test("current Coupang price is compared with the required price floor", () => {
  const candidate = item({ supplierPriceKrw: 5_000 });
  const score = publicCatalogOpportunityScores(
    candidate,
    [candidate],
    0,
    "2026-08-25T00:00:00.000Z",
    {
      version: COUPANG_MARKET_PRICE_ESTIMATE_VERSION,
      status: "AVAILABLE",
      matchType: "TITLE_MATCHED",
      query: "공개 상품",
      observedAt: "2026-08-25T00:00:00.000Z",
      predictedSellingPriceKrw: 5_000,
      lowSellingPriceKrw: 4_900,
      highSellingPriceKrw: 5_500,
      observationCount: 3,
      sourceReference: "naver-shopping-official:coupang-public-offers",
      sampleOffers: [],
    },
  );
  assert.equal(score.profitability.status, "AVAILABLE");
  assert.equal(score.profitability.normalizedScore, 20);
  assert.equal(score.profitability.evidence[0]?.sourceType, "MARKETPLACE_PUBLIC");
});
