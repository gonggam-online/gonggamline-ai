import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildContentClusters, buildFinderAlerts, buildKeywordFinderProfiles, buildShoppingContentFeed, classifyContentMarket, extractProductPhrase } from "../lib/market/item-discovery-workbench.ts";
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
      channelCountry: "US",
    },
  }]);
  assert.equal(feed.length, 1);
  assert.equal(feed[0]?.platform, "YOUTUBE");
  assert.equal(feed[0]?.verdict, "SHOPPING_CONTENT");
  assert.equal(feed[0]?.referenceOnly, true);
  assert.match(feed[0]?.extractedProduct ?? "", /싱크대 주방정리 회전 트레이/);
  assert.equal(feed[0]?.marketZone, "OVERSEAS");
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

test("channel country is classified without guessing missing evidence", () => {
  assert.equal(classifyContentMarket("KR"), "DOMESTIC");
  assert.equal(classifyContentMarket("US"), "OVERSEAS");
  assert.equal(classifyContentMarket(null), "UNKNOWN");
});

test("content clusters and alerts turn repeated public signals into investigation work", () => {
  const content = buildShoppingContentFeed([{
    concept: "주방정리", provider: "youtube-data-api", observedAt: "2026-08-26T00:00:00.000Z", demandIndex: 80, contentVelocity: 72, shoppingIntent: null, competitionPressure: null, priceRoom: null,
    evidence: { title: "주방정리 회전 트레이 추천", viewCount: 50_000, isShort: true, channelCountry: "KR" },
  }]);
  assert.equal(buildContentClusters(content)[0]?.contentCount, 1);
  const profiles = buildKeywordFinderProfiles({ opportunities: [opportunity], signals: [], prices: [] });
  assert.equal(buildFinderAlerts(profiles, [])[0]?.kind, "MARKET_BREAKOUT");
  assert.ok(buildFinderAlerts(profiles, []).some((item) => item.kind === "EVIDENCE_GAP"));
});

test("watchlist registration is AAL1 secured and creates all bounded provider jobs", () => {
  const route = readFileSync(new URL("../app/api/market/keywords/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/market/finder/page.tsx", import.meta.url), "utf8");
  const csrf = readFileSync(new URL("../app/api/admin/auth/csrf/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminRequest\(request, "read"\)/);
  assert.match(route, /requireExactAdminOrigin\(request\)/);
  assert.match(route, /verifyAdminCsrfToken\(request, "market-keyword-write", context\)/);
  for (const collector of ["naver-shopping-api", "youtube-public-signals", "dataforseo-naver-serp"]) assert.match(route, new RegExp(collector));
  assert.match(page, /X-GonggamLine-CSRF/);
  assert.match(csrf, /purpose === "market-keyword-write"/);
});
