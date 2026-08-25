import assert from "node:assert/strict";
import test from "node:test";

import { estimateItemSelectionDiscoveryProfitability } from "../shared/domain/item-selection-discovery-profitability.ts";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog.ts";

function item(overrides: Partial<SupplierCatalogItem> = {}): SupplierCatalogItem {
  return {
    provider: "domeggook",
    providerItemId: "1001",
    name: "공개 상품",
    supplierPriceKrw: 5_000,
    shippingFeeKrw: 3_000,
    minimumOrderQuantity: 6,
    stockStatus: "in_stock",
    thumbnailUrl: null,
    productUrl: "https://example.com/1001",
    supplierId: "supplier",
    supplierName: "공급처",
    availableOnDomeggook: true,
    supplyAvailable: true,
    ...overrides,
  };
}

test("allocates supplier shipping by MOQ and returns deterministic selling-price floors", () => {
  const candidate = item();
  const result = estimateItemSelectionDiscoveryProfitability(candidate, [candidate]);
  assert.equal(result.status, "ESTIMATED");
  assert.equal(result.costsPerUnitKrw.supplierInboundBase, 500);
  assert.equal(result.profitabilityPotentialScore, 70);
  assert(result.floorSellingPriceKrw.breakEven! < result.floorSellingPriceKrw.conditional!);
  assert(result.floorSellingPriceKrw.conditional! <= result.floorSellingPriceKrw.recommend!);
  assert(result.missingActualFacts.includes("productDimensionsAndWeight"));
  assert.deepEqual(result, estimateItemSelectionDiscoveryProfitability(candidate, [candidate]));
});

test("uses explicit conservative fallbacks but never invents a missing supplier price", () => {
  const missingShipping = item({ shippingFeeKrw: null, minimumOrderQuantity: null });
  const estimated = estimateItemSelectionDiscoveryProfitability(missingShipping, [missingShipping]);
  assert.equal(estimated.costsPerUnitKrw.supplierInboundBase, 3_000);
  assert(estimated.missingActualFacts.includes("supplierShippingFee"));
  assert(estimated.missingActualFacts.includes("minimumOrderQuantity"));

  const missingPrice = estimateItemSelectionDiscoveryProfitability(
    item({ supplierPriceKrw: null }),
    [item({ supplierPriceKrw: null })],
  );
  assert.equal(missingPrice.status, "UNAVAILABLE");
  assert.equal(missingPrice.floorSellingPriceKrw.recommend, null);
});

