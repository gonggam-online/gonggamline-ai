import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSkuMarketRankings,
  type SkuMarketProduct,
  type SkuSupplierQuote,
} from "../lib/market/sku-market-ranking";
import type { MarketOpportunity } from "../lib/market/autonomous-intelligence";
import { importTikTokFixture } from "../lib/market/tiktok-import";
import { createExternalMarketSignalPacket } from "../shared/contracts/external-market-signal-packet";

const opportunity = (concept = "욕실 정리 선반"): MarketOpportunity => ({
  concept,
  state: "RISING",
  lane: "DISCOVER_NOW",
  score: 82,
  confidence: 74,
  demand: 80,
  momentum: 20,
  acceleration: 10,
  persistence: 75,
  shoppingIntent: 80,
  contentVelocity: 68,
  competitionHeadroom: 55,
  priceRoom: 60,
  sourceAgreement: 80,
  providers: ["naver", "youtube"],
  evidenceIds: ["a", "b"],
  asOf: "2026-08-27T00:00:00.000Z",
  reasons: ["검증 근거"],
});

const product = (
  overrides: Partial<SkuMarketProduct> = {},
): SkuMarketProduct => ({
  id: 1,
  externalProductId: "95937719177",
  vendorItemId: "16350191034",
  title: "무타공 욕실 정리 선반 블랙 1개",
  source: "coupang_public",
  url: "https://www.coupang.com/vp/products/95937719177",
  brand: null,
  category: "욕실용품",
  price: 12900,
  reviewCount: 120,
  rank: 4,
  rocketType: "rocket",
  observedAt: "2026-08-27T00:00:00.000Z",
  opportunityScore: 78,
  confidence: 75,
  isSoldOut: false,
  estimatedUnitsLow: 180,
  estimatedUnitsBase: 240,
  estimatedUnitsHigh: 310,
  stockoutCount30d: 0,
  observationDays: 30,
  snapshotCount: 8,
  ...overrides,
});

const quote = (
  overrides: Partial<SkuSupplierQuote> = {},
): SkuSupplierQuote => ({
  id: 9,
  productName: "무타공 욕실 정리 선반 블랙 1개",
  supplierSku: "95937719177",
  unitCost: 4200,
  moq: 10,
  domesticShippingTotal: 3000,
  inspectionTotal: 1000,
  packagingTotal: 1000,
  labelingTotal: 500,
  threePlInboundTotal: 1500,
  threePlStoragePerUnit: 100,
  threePlOutboundPerUnit: 700,
  coupangFeeRate: 10.8,
  expectedReturnRate: 3,
  validUntil: "2026-09-05",
  status: "received",
  updatedAt: "2026-08-27T00:00:00.000Z",
  ...overrides,
});

const corroborated = (
  baseId: number,
  overrides: Partial<SkuMarketProduct>,
): readonly SkuMarketProduct[] => {
  const coupang = product({
    id: baseId,
    externalProductId: `c-${baseId}`,
    vendorItemId: `v-${baseId}`,
    source: "coupang_public",
    ...overrides,
  });
  return [
    coupang,
    product({
      ...coupang,
      id: baseId + 1,
      externalProductId: `n-${baseId}`,
      vendorItemId: null,
      source: "naver_official",
      url: `https://shopping.naver.com/product/n-${baseId}`,
    }),
  ];
};

const verifiedCohort = (): readonly SkuMarketProduct[] => [
  ...corroborated(101, {
    title: "무타공 욕실 정리 선반 블랙 1개",
    reviewCount: 25,
    rank: 1,
    estimatedUnitsBase: 800,
    estimatedUnitsLow: 650,
    estimatedUnitsHigh: 950,
  }),
  ...corroborated(111, {
    title: "흡착식 코너 수납 랙 화이트 1개",
    searchKeywords: ["욕실 정리 선반"],
    reviewCount: 420,
    rank: 5,
    estimatedUnitsBase: 400,
    estimatedUnitsLow: 320,
    estimatedUnitsHigh: 480,
  }),
  ...corroborated(121, {
    title: "스테인리스 욕실 샤워 선반 실버 1개",
    reviewCount: 1_600,
    rank: 10,
    estimatedUnitsBase: 220,
    estimatedUnitsLow: 170,
    estimatedUnitsHigh: 270,
  }),
];

test("actual Coupang SKU combines only product-relevant TikTok and fresh exact quote", () => {
  const relevant = importTikTokFixture(
    {
      id: "video-1",
      keyword: "욕실 정리 선반",
      title: "무타공 욕실 정리 선반 블랙 1개 사용법",
      views: 10000,
      likes: 1000,
    },
    new Date("2026-08-27T00:00:00Z"),
  );
  const generic = importTikTokFixture(
    {
      id: "video-2",
      keyword: "빅뱅 챌린지",
      title: "인기 아이돌 댄스 챌린지",
      views: 999999,
      likes: 99999,
    },
    new Date("2026-08-27T00:00:00Z"),
  );
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [...verifiedCohort()],
    packets: [relevant, generic],
    quotes: [quote({ supplierSku: "c-101" })],
    now: new Date("2026-08-27T01:00:00Z"),
  });
  const selected = result.rankings.find(
    (item) => item.marketProductId === 101,
  )!;
  assert.ok(selected);
  assert.equal(selected.coupangMatch, "COUPANG_EXACT");
  assert.equal(selected.relevantTikTokSignals, 1);
  assert.equal(selected.ignoredTikTokSignals, 1);
  assert.equal(selected.supplierQuoteFresh, true);
  assert.equal(selected.skuLogisticsCostKrw, 1500);
  assert.equal(selected.estimatedProfitKrw, 5613.3);
  assert.deepEqual(selected.missingEvidence, []);
  assert.equal(selected.qualification, "SELL_READY");
  assert.equal(selected.availability, "IN_STOCK");
  assert.equal(selected.estimatedMonthlyRevenueKrw, 10_320_000);
  assert.ok(selected.coupangOpportunityScore >= 58);
  assert.equal(selected.opportunityArchetype, "LOW_REVIEW_HIGH_SALES");
  assert.equal(result.verificationQueue.length, 1);
});

test("option and pack mismatch cannot become an identical product match", () => {
  const packet = createExternalMarketSignalPacket({
    source: "COUPANG",
    upstreamSource: "COUPANG",
    observedVia: "TENBI",
    collectedAt: "2026-08-27T00:00:00Z",
    validUntil: "2026-09-01T00:00:00Z",
    keywordId: "욕실 선반",
    productIdentity: {
      title: "무타공 욕실 정리 선반 화이트 3개",
      brand: null,
      model: null,
    },
    platformProductId: "different",
    sourceUrl: "https://coupang.com/x",
    categoryBinding: null,
    demand: {},
    competition: {},
    socialMomentum: {},
    priceSnapshot: {},
    reviewSnapshot: {},
    rankingSnapshot: {},
    rocketShare: null,
    supplierQuoteBinding: null,
    logisticsCostBinding: null,
    evidenceConfidence: 50,
    missingEvidence: [],
    provenance: {},
  });
  const nonCoupang = product({
    source: "manual",
    url: "https://tenb.io/item/1",
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [nonCoupang],
    packets: [packet],
    quotes: [],
    now: new Date("2026-08-27T00:30:00Z"),
  });
  assert.equal(result.rankings.length, 0);
  assert.equal(result.verificationQueue[0].coupangMatch, "NO_MATCH");
  assert.ok(
    result.verificationQueue[0].missingEvidence.includes(
      "PRODUCT_IDENTITY_CORROBORATION",
    ),
  );
  assert.ok(
    result.verificationQueue[0].missingEvidence.includes(
      "COUPANG_IDENTICAL_PRODUCT_MATCH",
    ),
  );
  assert.ok(result.discoveryQueries.length > 0);
});

test("stale quote and unrelated KK946 logistics are not copied to another SKU", () => {
  const stale = quote({
    id: 10,
    supplierSku: "KK946-BLACK",
    productName: "KK946 파우치 블랙",
    validUntil: "2026-08-01",
    updatedAt: "2026-08-01T00:00:00Z",
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [product()],
    packets: [],
    quotes: [stale],
    now: new Date("2026-08-27T00:00:00Z"),
  });
  assert.equal(result.verificationQueue[0].supplierQuoteId, null);
  assert.equal(result.verificationQueue[0].skuLogisticsCostKrw, null);
  assert.ok(
    result.verificationQueue[0].missingEvidence.includes(
      "FRESH_SUPPLIER_QUOTE",
    ),
  );
});

test("same input produces stable deduplicated ranking and digest", () => {
  const input = {
    opportunities: [opportunity()],
    products: [...verifiedCohort()],
    packets: [],
    quotes: [quote({ supplierSku: "c-101" })],
  };
  const first = buildSkuMarketRankings({
    ...input,
    now: new Date("2026-08-27T00:00:00Z"),
  });
  const second = buildSkuMarketRankings({
    ...input,
    now: new Date("2026-08-27T00:00:00Z"),
  });
  assert.deepEqual(first, second);
  assert.equal(first.digest, second.digest);
  assert.deepEqual(
    first.rankings.map((item) => item.rank),
    first.rankings.map((_, index) => index + 1),
  );
  assert.equal(first.audit.deduplicatedSkuProducts, 3);
});

test("two independent providers can corroborate a fresh actual SKU without padding", () => {
  const naver = product({
    id: 11,
    externalProductId: "naver-11",
    vendorItemId: null,
    source: "naver_official",
    url: "https://shopping.naver.com/product/11",
    searchKeywords: ["욕실 정리 선반"],
  });
  const dataForSeo = product({
    id: 12,
    externalProductId: "dfs-12",
    vendorItemId: null,
    source: "dataforseo_naver",
    url: "https://shopping.naver.com/product/12",
    searchKeywords: ["욕실 정리 선반"],
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [naver, dataForSeo],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T01:00:00Z"),
  });
  assert.equal(result.rankings.length, 0);
  assert.equal(result.verificationQueue.length, 1);
  assert.ok(
    result.verificationQueue[0].identityProviders.includes("naver_official"),
  );
  assert.ok(
    result.verificationQueue[0].identityProviders.includes("dataforseo_naver"),
  );
  assert.ok(
    result.verificationQueue[0].missingEvidence.includes(
      "COMPARABLE_COUPANG_COHORT",
    ),
  );
  assert.equal(result.audit.deduplicatedSkuProducts, 1);
});

test("sold-out or unknown-stock products never enter the sell-now ranking", () => {
  const inStock = product({
    id: 41,
    externalProductId: "41",
    vendorItemId: "v-41",
    source: "coupang_public",
  });
  const corroboration = product({
    id: 42,
    externalProductId: "42",
    vendorItemId: "v-41",
    source: "naver_official",
    url: "https://shopping.naver.com/product/42",
  });
  const soldOut = product({
    id: 43,
    externalProductId: "43",
    vendorItemId: "v-43",
    title: "흡착식 코너 수납 랙 화이트 1개",
    searchKeywords: ["욕실 정리 선반"],
    isSoldOut: true,
  });
  const soldOutCorroboration = product({
    id: 44,
    externalProductId: "44",
    vendorItemId: "v-43",
    title: "흡착식 코너 수납 랙 화이트 1개",
    searchKeywords: ["욕실 정리 선반"],
    source: "naver_official",
    url: "https://shopping.naver.com/product/44",
    isSoldOut: true,
  });
  const unknown = product({
    id: 45,
    externalProductId: "45",
    vendorItemId: "v-45",
    title: "스테인리스 샤워 수납대 그레이 1개",
    searchKeywords: ["욕실 정리 선반"],
    isSoldOut: null,
  });
  const unknownCorroboration = product({
    id: 46,
    externalProductId: "46",
    vendorItemId: "v-45",
    title: "스테인리스 샤워 수납대 그레이 1개",
    searchKeywords: ["욕실 정리 선반"],
    source: "naver_official",
    url: "https://shopping.naver.com/product/46",
    isSoldOut: null,
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [
      inStock,
      corroboration,
      soldOut,
      soldOutCorroboration,
      unknown,
      unknownCorroboration,
    ],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T01:00:00Z"),
  });
  assert.ok(result.rankings.length <= 1);
  assert.ok(result.rankings.every((item) => item.availability === "IN_STOCK"));
  assert.ok(
    result.verificationQueue.some((item) =>
      item.missingEvidence.includes("CURRENTLY_SOLD_OUT"),
    ),
  );
  assert.ok(
    result.verificationQueue.some((item) =>
      item.missingEvidence.includes("CURRENT_AVAILABILITY"),
    ),
  );
  assert.equal(result.audit.soldOutProducts, 1);
  assert.equal(result.audit.unknownAvailabilityProducts, 1);
});

test("low-review high-sales opportunity outranks review-heavy weaker demand within the verified cohort", () => {
  const efficient = product({
    id: 51,
    externalProductId: "51",
    vendorItemId: "v-51",
    title: "무타공 욕실 정리 선반 블랙 1개",
    reviewCount: 25,
    estimatedUnitsBase: 600,
  });
  const efficientMatch = product({
    id: 52,
    externalProductId: "52",
    vendorItemId: "v-51",
    title: efficient.title,
    source: "naver_official",
    url: "https://shopping.naver.com/product/52",
    reviewCount: 25,
    estimatedUnitsBase: 600,
  });
  const crowded = product({
    id: 53,
    externalProductId: "53",
    vendorItemId: "v-53",
    title: "흡착식 코너 수납 랙 화이트 1개",
    reviewCount: 2_000,
    estimatedUnitsBase: 180,
    searchKeywords: ["욕실 정리 선반"],
  });
  const crowdedMatch = product({
    id: 54,
    externalProductId: "54",
    vendorItemId: "v-53",
    title: crowded.title,
    source: "naver_official",
    url: "https://shopping.naver.com/product/54",
    reviewCount: 2_000,
    estimatedUnitsBase: 180,
    searchKeywords: ["욕실 정리 선반"],
  });
  const middle = product({
    id: 55,
    externalProductId: "55",
    vendorItemId: "v-55",
    title: "스테인리스 샤워 수납대 베이지 1개",
    reviewCount: 350,
    estimatedUnitsBase: 320,
    rank: 7,
    searchKeywords: ["욕실 정리 선반"],
  });
  const middleMatch = product({
    id: 56,
    externalProductId: "56",
    vendorItemId: "v-55",
    title: middle.title,
    source: "naver_official",
    url: "https://shopping.naver.com/product/56",
    reviewCount: 350,
    estimatedUnitsBase: 320,
    rank: 7,
    searchKeywords: ["욕실 정리 선반"],
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [
      crowded,
      crowdedMatch,
      efficient,
      efficientMatch,
      middle,
      middleMatch,
    ],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T01:00:00Z"),
  });
  assert.equal(result.rankings[0].title, efficient.title);
  assert.equal(
    result.rankings[0].opportunityArchetype,
    "LOW_REVIEW_HIGH_SALES",
  );
  assert.ok(
    result.rankings[0].demandEfficiencyScore >
      result.rankings.at(-1)!.demandEfficiencyScore,
  );
});

test("sales and revenue evidence are mandatory even when market rank and price exist", () => {
  const noSales = product({
    id: 61,
    externalProductId: "61",
    estimatedUnitsLow: null,
    estimatedUnitsBase: null,
    estimatedUnitsHigh: null,
  });
  const match = product({
    id: 62,
    externalProductId: "62",
    source: "naver_official",
    url: "https://shopping.naver.com/product/62",
    estimatedUnitsLow: null,
    estimatedUnitsBase: null,
    estimatedUnitsHigh: null,
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [noSales, match],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T01:00:00Z"),
  });
  assert.equal(result.rankings.length, 0);
  assert.ok(
    result.verificationQueue.every((item) =>
      item.missingEvidence.includes("ESTIMATED_SALES_EVIDENCE"),
    ),
  );
  assert.ok(
    result.verificationQueue.every((item) =>
      item.missingEvidence.includes("ESTIMATED_REVENUE_EVIDENCE"),
    ),
  );
});

test("unmatched actual products stay in the bounded verification queue", () => {
  const unmatched = product({
    id: 21,
    externalProductId: "manual-21",
    vendorItemId: null,
    source: "tenbi_import",
    url: "https://tenb.io/item/21",
    title: "초경량 접이식 여행 파우치 네이비",
    category: "여행용품",
    searchKeywords: [],
  });
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: [unmatched],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T01:00:00Z"),
  });
  assert.equal(result.rankings.length, 0);
  assert.equal(result.verificationQueue.length, 1);
  assert.equal(result.verificationQueue[0].qualification, "VERIFY_NEXT");
  assert.ok(
    result.verificationQueue[0].missingEvidence.includes(
      "MARKET_OPPORTUNITY_MATCH",
    ),
  );
  assert.ok(result.discoveryQueries.length >= 1);
  assert.ok(result.discoveryQueries.every((query) => query.length <= 60));
});

test("synthetic, demo, and social-content rows never enter SKU discovery while a missing price is actively verified", () => {
  const candidates = [
    product({
      id: 31,
      externalProductId: "demo-31",
      brand: "공감데모",
      price: 12_900,
    }),
    product({
      id: 32,
      externalProductId: "social-32",
      source: "youtube_public",
      url: "https://youtube.com/shorts/32",
      price: 12_900,
    }),
    product({ id: 33, externalProductId: "missing-price-33", price: null }),
  ];
  const result = buildSkuMarketRankings({
    opportunities: [opportunity()],
    products: candidates,
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T00:00:00Z"),
  });
  assert.equal(result.audit.rawProductCandidates, 3);
  assert.equal(result.audit.excludedNonSkuProducts, 2);
  assert.equal(result.audit.actualSkuProducts, 1);
  assert.deepEqual(result.rankings, []);
  assert.equal(result.verificationQueue.length, 1);
  assert.ok(
    result.verificationQueue[0].missingEvidence.includes(
      "CURRENT_MARKET_PRICE",
    ),
  );
  assert.ok(result.discoveryQueries.length > 0);
});

test("cross-provider opportunities seed product discovery when no actual SKU exists yet", () => {
  const result = buildSkuMarketRankings({
    opportunities: [opportunity("틈새 수납")],
    products: [],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T00:00:00Z"),
  });
  assert.equal(result.audit.actualSkuProducts, 0);
  assert.deepEqual(result.rankings, []);
  assert.deepEqual(result.verificationQueue, []);
  assert.deepEqual(result.discoveryQueries, [
    "틈새 수납",
    "틈새 수납 인기상품",
  ]);
  assert.equal(result.audit.scheduledSearchQueries, 2);
});

test("single-source and low-confidence opportunities do not seed SKU searches", () => {
  const weak = {
    ...opportunity("불확실 상품"),
    providers: ["youtube"],
    confidence: 40,
  };
  const result = buildSkuMarketRankings({
    opportunities: [weak],
    products: [],
    packets: [],
    quotes: [],
    now: new Date("2026-08-27T00:00:00Z"),
  });
  assert.deepEqual(result.discoveryQueries, []);
});
