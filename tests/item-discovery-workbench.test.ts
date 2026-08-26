import assert from "node:assert/strict";
import test from "node:test";

import { buildKeywordFinderProfiles, buildShoppingContentFeed, extractProductPhrase } from "../lib/market/item-discovery-workbench.ts";
import type { MarketOpportunity } from "../lib/market/autonomous-intelligence.ts";

const opportunity: MarketOpportunity = {
  concept: "주방정리",
  state: "RISING",
  lane: "DISCOVER_NOW",
  score: 78,
  confidence: 74,
  demand: 72,
  momentum: 18,
  acceleration: 10,
  persistence: 68,
  shoppingIntent: 76,
  contentVelocity: 64,
  competitionHeadroom: 61,
  priceRoom: 55,
  sourceAgreement: 80,
  providers: ["naver-api-hub-shopping-insight", "youtube-data-api"],
  evidenceIds: ["e1", "e2"],
  asOf: "2026-08-26T00:00:00.000Z",
  reasons: ["수요 상승"],
};

test("shopping content feed ranks product evidence and preserves reference-only status", () => {
  const feed = buildShoppingContentFeed([{
    concept: "주방정리",
    provider: "youtube-data-api",
    observedAt: "2026-08-26T00:00:00.000Z",
    demandIndex: 80,
    contentVelocity: 72,
    shoppingIntent: null,
    competitionPressure: null,
    priceRoom: null,
    evidence: {
      title: "[내돈내산] 싱크대 주방정리 회전 트레이 추천템 #shorts",
      sourceUrl: "https://www.youtube.com/watch?v=video-1",
      channelTitle: "살림연구소",
      viewCount: 123_456,
      isShort: true,
    },
  }]);
  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.platform, "YOUTUBE");
  assert.equal(feed[0]?.verdict, "SHOPPING_CONTENT");
  assert.equal(feed[0]?.referenceOnly, true);
  assert.match(feed[0]?.extractedProduct ?? "", /싱크대 주방정리 회전 트레이/);
});

test("generic entertainment is not promoted as shopping content", () => {
  const feed = buildShoppingContentFeed([{
    concept: "주방정리",
    provider: "youtube-data-api",
    observedAt: "2026-08-26T00:00:00.000Z",
    demandIndex: 20,
    contentVelocity: 2,
    shoppingIntent: null,
    competitionPressure: null,
    priceRoom: null,
    evidence: { title: "주방정리 브이로그 먹방 챌린지", sourceUrl: null },
  }]);
  assert.equal(feed[0]?.verdict, "REVIEW");
});

test("keyword finder profile combines trend, real monthly evidence, price and YouTube landscape", () => {
  const signals = [
    { concept: "주방정리", provider: "youtube-data-api", observedAt: "2026-07-01T00:00:00.000Z", demandIndex: 55, contentVelocity: 40, shoppingIntent: null, competitionPressure: null, priceRoom: null, evidence: { title: "주방정리 트레이 추천", viewCount: 10_000, isShort: true } },
    { concept: "주방정리", provider: "naver-api-hub-shopping-insight", observedAt: "2026-08-01T00:00:00.000Z", demandIndex: 75, contentVelocity: 20, shoppingIntent: 75, competitionPressure: 35, priceRoom: 60, evidence: { title: "주방정리 쇼핑 클릭 추이" } },
  ] as const;
  const profiles = buildKeywordFinderProfiles({
    opportunities: [opportunity],
    signals,
    prices: [{ productId: 1, title: "주방정리 회전 트레이", source: "coupang_public", url: null, price: 12_900, rank: 1, reviewCount: 20, observedAt: "2026-08-26T00:00:00.000Z" }],
  });
  assert.equal(profiles.length, 1);
  assert.deepEqual(profiles[0]?.priceBenchmark, { sampleCount: 1, minimum: 12_900, median: 12_900, maximum: 12_900 });
  assert.equal((profiles[0]?.seasonality as Array<unknown>).length, 2);
  assert.equal((profiles[0]?.youtubeLandscape as { shortsRatio: number }).shortsRatio, 100);
});

test("product phrase extraction removes promotional wrappers deterministically", () => {
  assert.equal(extractProductPhrase("[광고] 욕실 코너 선반 추천템 #shorts", "욕실정리"), "욕실 코너 선반");
});
