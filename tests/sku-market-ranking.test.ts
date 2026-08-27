import assert from "node:assert/strict";
import test from "node:test";

import { buildSkuMarketRankings, type SkuMarketProduct, type SkuSupplierQuote } from "../lib/market/sku-market-ranking";
import type { MarketOpportunity } from "../lib/market/autonomous-intelligence";
import { importTikTokFixture } from "../lib/market/tiktok-import";
import { createExternalMarketSignalPacket } from "../shared/contracts/external-market-signal-packet";

const opportunity = (concept = "욕실 정리 선반"): MarketOpportunity => ({
  concept, state: "RISING", lane: "DISCOVER_NOW", score: 82, confidence: 74, demand: 80, momentum: 20,
  acceleration: 10, persistence: 75, shoppingIntent: 80, contentVelocity: 68, competitionHeadroom: 55,
  priceRoom: 60, sourceAgreement: 80, providers: ["naver", "youtube"], evidenceIds: ["a", "b"],
  asOf: "2026-08-27T00:00:00.000Z", reasons: ["검증 근거"],
});

const product = (overrides: Partial<SkuMarketProduct> = {}): SkuMarketProduct => ({
  id: 1, externalProductId: "95937719177", vendorItemId: "16350191034", title: "무타공 욕실 정리 선반 블랙 1개",
  source: "coupang_public", url: "https://www.coupang.com/vp/products/95937719177", brand: null, category: "욕실용품",
  price: 12900, reviewCount: 120, rank: 4, rocketType: "rocket", observedAt: "2026-08-27T00:00:00.000Z",
  opportunityScore: 78, confidence: 75, ...overrides,
});

const quote = (overrides: Partial<SkuSupplierQuote> = {}): SkuSupplierQuote => ({
  id: 9, productName: "무타공 욕실 정리 선반 블랙 1개", supplierSku: "95937719177", unitCost: 4200, moq: 10,
  domesticShippingTotal: 3000, inspectionTotal: 1000, packagingTotal: 1000, labelingTotal: 500,
  threePlInboundTotal: 1500, threePlStoragePerUnit: 100, threePlOutboundPerUnit: 700,
  coupangFeeRate: 10.8, expectedReturnRate: 3,
  validUntil: "2026-09-05", status: "received", updatedAt: "2026-08-27T00:00:00.000Z", ...overrides,
});

test("actual Coupang SKU combines only product-relevant TikTok and fresh exact quote", () => {
  const relevant = importTikTokFixture({ id: "video-1", keyword: "욕실 정리 선반", title: "무타공 욕실 정리 선반 블랙 1개 사용법", views: 10000, likes: 1000 }, new Date("2026-08-27T00:00:00Z"));
  const generic = importTikTokFixture({ id: "video-2", keyword: "빅뱅 챌린지", title: "인기 아이돌 댄스 챌린지", views: 999999, likes: 99999 }, new Date("2026-08-27T00:00:00Z"));
  const result = buildSkuMarketRankings({ opportunities: [opportunity()], products: [product()], packets: [relevant, generic], quotes: [quote()], now: new Date("2026-08-27T01:00:00Z") });
  assert.equal(result.rankings.length, 1);
  assert.equal(result.rankings[0].coupangMatch, "COUPANG_EXACT");
  assert.equal(result.rankings[0].relevantTikTokSignals, 1);
  assert.equal(result.rankings[0].ignoredTikTokSignals, 1);
  assert.equal(result.rankings[0].supplierQuoteFresh, true);
  assert.equal(result.rankings[0].skuLogisticsCostKrw, 1500);
  assert.equal(result.rankings[0].estimatedProfitKrw, 5613.3);
  assert.deepEqual(result.rankings[0].missingEvidence, []);
});

test("option and pack mismatch cannot become an identical product match", () => {
  const packet = createExternalMarketSignalPacket({ source: "COUPANG", upstreamSource: "COUPANG", observedVia: "TENBI", collectedAt: "2026-08-27T00:00:00Z", validUntil: "2026-09-01T00:00:00Z", keywordId: "욕실 선반", productIdentity: { title: "무타공 욕실 정리 선반 화이트 3개", brand: null, model: null }, platformProductId: "different", sourceUrl: "https://coupang.com/x", categoryBinding: null, demand: {}, competition: {}, socialMomentum: {}, priceSnapshot: {}, reviewSnapshot: {}, rankingSnapshot: {}, rocketShare: null, supplierQuoteBinding: null, logisticsCostBinding: null, evidenceConfidence: 50, missingEvidence: [], provenance: {} });
  const nonCoupang = product({ source: "manual", url: "https://tenb.io/item/1" });
  const result = buildSkuMarketRankings({ opportunities: [opportunity()], products: [nonCoupang], packets: [packet], quotes: [], now: new Date("2026-08-27T00:30:00Z") });
  assert.equal(result.rankings[0].coupangMatch, "NO_MATCH");
  assert.ok(result.rankings[0].missingEvidence.includes("COUPANG_IDENTICAL_PRODUCT_MATCH"));
});

test("stale quote and unrelated KK946 logistics are not copied to another SKU", () => {
  const stale = quote({ id: 10, supplierSku: "KK946-BLACK", productName: "KK946 파우치 블랙", validUntil: "2026-08-01", updatedAt: "2026-08-01T00:00:00Z" });
  const result = buildSkuMarketRankings({ opportunities: [opportunity()], products: [product()], packets: [], quotes: [stale], now: new Date("2026-08-27T00:00:00Z") });
  assert.equal(result.rankings[0].supplierQuoteId, null);
  assert.equal(result.rankings[0].skuLogisticsCostKrw, null);
  assert.ok(result.rankings[0].missingEvidence.includes("FRESH_SUPPLIER_QUOTE"));
});

test("same input produces stable ranking and digest", () => {
  const input = { opportunities: [opportunity()], products: [product(), product({ id: 2, externalProductId: "2", title: "욕실 정리 선반 블랙 2개", price: 14900 })], packets: [], quotes: [quote()] };
  const first = buildSkuMarketRankings({ ...input, now: new Date("2026-08-27T00:00:00Z") });
  const second = buildSkuMarketRankings({ ...input, now: new Date("2026-08-27T00:00:00Z") });
  assert.deepEqual(first, second);
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.rankings.map((item) => item.rank), [1, 2]);
});
