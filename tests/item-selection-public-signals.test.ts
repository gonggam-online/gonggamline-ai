import assert from "node:assert/strict";
import test from "node:test";

import { publicCatalogOpportunityScores } from "../shared/domain/item-selection-public-signals.ts";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog.ts";

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
  assert.equal(first.profitability.status, "UNAVAILABLE");
  for (const area of ["competitiveness", "demand", "conversionPotential", "logisticsFit", "supplyStability"] as const) {
    assert.equal(first[area].status, "AVAILABLE");
    assert.equal(first[area].evidence[0]?.sourceType, "PUBLIC_SUPPLIER_CATALOG");
  }
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
