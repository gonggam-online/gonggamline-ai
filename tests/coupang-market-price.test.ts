import assert from "node:assert/strict";
import test from "node:test";

import { loadCoupangMarketPriceEstimates } from "../services/coupang-market-price.service.ts";
import type { SupplierCatalogItem } from "../shared/domain/supplier-catalog.ts";

const candidate: SupplierCatalogItem = {
  provider: "domeggook",
  providerItemId: "1000",
  name: "무타공 주방 정리 선반",
  supplierPriceKrw: 5_000,
  shippingFeeKrw: 3_000,
  minimumOrderQuantity: 1,
  stockStatus: "in_stock",
  thumbnailUrl: null,
  productUrl: "https://domeggook.com/1000",
  supplierId: null,
  supplierName: null,
  availableOnDomeggook: true,
  supplyAvailable: true,
};

test("uses only title-matched public Coupang offers and returns a robust median", async () => {
  const estimates = await loadCoupangMarketPriceEstimates([candidate], "주방 정리 선반", async (keyword) => ({
    provider: "naver_shopping",
    requestCount: 1,
    quotaUnits: 1,
    estimatedCostUsd: 0,
    discoverySignals: [],
    observations: [
      observation(keyword, "쿠팡", "무타공 주방 정리 선반 1단", 12_900, 1),
      observation(keyword, "Coupang", "주방 정리 무타공 선반", 15_900, 2),
      observation(keyword, "다른몰", "무타공 주방 정리 선반", 1_000, 3),
      observation(keyword, "쿠팡", "블루투스 이어폰", 30_000, 4),
    ],
  }));
  const estimate = estimates.get("1000");
  assert.equal(estimate?.status, "AVAILABLE");
  assert.equal(estimate?.predictedSellingPriceKrw, 14_400);
  assert.equal(estimate?.lowSellingPriceKrw, 13_700);
  assert.equal(estimate?.highSellingPriceKrw, 15_200);
  assert.equal(estimate?.observationCount, 2);
  assert.equal(estimate?.sampleOffers.length, 2);
});

test("fails open as unavailable without inventing a selling price", async () => {
  const estimates = await loadCoupangMarketPriceEstimates([candidate], "주방 정리 선반", async () => {
    throw new Error("NAVER_CREDENTIALS_MISSING");
  });
  assert.equal(estimates.get("1000")?.status, "UNAVAILABLE");
  assert.equal(estimates.get("1000")?.predictedSellingPriceKrw, null);
});

test("uses the run keyword Coupang comparison group when a candidate title has no direct match", async () => {
  const estimates = await loadCoupangMarketPriceEstimates([candidate], "욕실 수납", async (keyword) => ({
    provider: "naver_shopping",
    requestCount: 1,
    quotaUnits: 1,
    estimatedCostUsd: 0,
    discoverySignals: [],
    observations: keyword.startsWith("욕실 수납")
      ? [observation(keyword, "쿠팡(주)", "욕실 청소 브러시", 19_900, 1)]
      : [],
  }));
  const estimate = estimates.get("1000");
  assert.equal(estimate?.status, "AVAILABLE");
  assert.equal(estimate?.matchType, "KEYWORD_COMPARABLE");
  assert.equal(estimate?.predictedSellingPriceKrw, 19_900);
});

test("falls back to one bounded paid Coupang public search when Naver has no Coupang offers", async () => {
  let paidCalls = 0;
  const estimates = await loadCoupangMarketPriceEstimates(
    [candidate],
    "욕실 수납",
    async () => ({ provider: "naver_shopping", requestCount: 1, quotaUnits: 1, estimatedCostUsd: 0, discoverySignals: [], observations: [] }),
    async (keyword) => {
      paidCalls += 1;
      return {
        requestCount: 1,
        estimatedCostUsd: 0.002,
        observations: [observation(keyword, "쿠팡", "욕실 청소 브러시", 18_900, 1)],
      };
    },
  );
  assert.equal(paidCalls, 1);
  assert.equal(estimates.get("1000")?.matchType, "KEYWORD_COMPARABLE");
  assert.equal(estimates.get("1000")?.predictedSellingPriceKrw, 18_900);
});

function observation(keyword: string, sellerName: string, title: string, price: number, rank: number) {
  return {
    source: "naver_official" as const,
    keyword,
    observedAt: "2026-08-25T00:00:00.000Z",
    product: {
      externalProductId: String(rank),
      vendorItemId: null,
      url: `https://search.shopping.naver.com/${rank}`,
      title,
      brand: null,
      sellerName,
      category: null,
      thumbnailUrl: null,
    },
    snapshot: {
      rank,
      isAd: null,
      price,
      listPrice: null,
      rating: null,
      reviewCount: null,
      rocketType: null,
      isSoldOut: null,
      deliveryDays: null,
      optionCount: null,
    },
  };
}
