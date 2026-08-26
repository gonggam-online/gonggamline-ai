import assert from "node:assert/strict";
import test from "node:test";

import {
  collectDataForSeoCoupangPrices,
  collectDataForSeoNaverSignals,
  collectExternalMarketProvider,
  collectNaverApiHubTrends,
  collectNaverShopping,
  collectYouTubeVideoSignals,
} from "../lib/market/external-provider-adapters.ts";
import { collectConfiguredMarketObservations } from "../services/market-observation-collector.service.ts";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("NAVER API HUB adapter uses current endpoint and headers without fabricating products", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await collectNaverApiHubTrends("수납 정리함", {
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    now: new Date("2026-08-26T00:00:00.000Z"),
    request: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return response({ results: [{ title: "수납 정리함", keywords: ["수납 정리함"], data: [{ period: "2026-07-28", ratio: 40 }, { period: "2026-08-26", ratio: 75 }] }] });
    },
  });
  assert.equal(requestUrl, "https://naverapihub.apigw.ntruss.com/search-trend/v1/search");
  assert.equal((requestInit?.headers as Record<string, string>)["X-NCP-APIGW-API-KEY-ID"], "client");
  assert.equal((requestInit?.headers as Record<string, string>)["X-NCP-APIGW-API-KEY"], "secret");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    startDate: "2026-07-28",
    endDate: "2026-08-26",
    timeUnit: "date",
    keywordGroups: [{ groupName: "수납 정리함", keywords: ["수납 정리함"] }],
  });
  assert.equal(result.provider, "naver_api_hub");
  assert.equal(result.observations.length, 0);
  assert.equal(result.discoverySignals.length, 1);
  assert.equal(result.discoverySignals[0]?.popularityScore, 75);
  assert.equal(result.discoverySignals[0]?.contentVelocity, 35);
});

test("NAVER API HUB optionally adds Shopping Insight only with an explicit category", async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const result = await collectNaverApiHubTrends("정리함", {
    credentials: { naverClientId: "client", naverClientSecret: "secret", naverShoppingCategoryId: "50000004" },
    now: new Date("2026-08-26T00:00:00.000Z"),
    request: async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      if (String(input).includes("search-trend")) {
        return response({ results: [{ data: [{ period: "2026-08-26", ratio: 60 }] }] });
      }
      return response({ results: [{ data: [{ period: "2026-08-26", ratio: 80 }] }] });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.url, "https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords");
  assert.deepEqual(calls[1]?.body, {
    startDate: "2026-07-28",
    endDate: "2026-08-26",
    timeUnit: "date",
    category: "50000004",
    keyword: [{ name: "정리함", param: ["정리함"] }],
  });
  assert.equal(result.requestCount, 2);
  assert.equal(result.discoverySignals[1]?.category, "50000004");
  assert.equal(result.discoverySignals[1]?.popularityScore, 80);
});

test("legacy Naver collector alias uses API HUB rather than the retired Developers endpoint", async () => {
  let requestedUrl = "";
  await collectNaverShopping("정리함", {
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    request: async (input) => {
      requestedUrl = String(input);
      return response({ results: [] });
    },
  });
  assert.match(requestedUrl, /naverapihub\.apigw\.ntruss\.com/);
  assert.doesNotMatch(requestedUrl, /openapi\.naver\.com/);
});

test("YouTube adapter returns reference-only discovery signals and never treats views as reviews", async () => {
  const result = await collectYouTubeVideoSignals("정리함", {
    credentials: { youtubeApiKey: "key" },
    request: async () => response({ items: [{ id: { videoId: "video-1" }, snippet: { title: "정리함 추천", publishedAt: "2026-08-19T00:00:00Z" } }] }),
  });
  assert.equal(result.observations.length, 0);
  assert.equal(result.discoverySignals[0]?.sourceKind, "short_video_public");
  assert.equal(result.discoverySignals[0]?.assetRights, "UNKNOWN");
  assert.equal(result.discoverySignals[0]?.reviewCount, null);
});

test("DataForSEO Naver adapter maps paid SERP output without storing credentials", async () => {
  let authorization = "";
  const result = await collectDataForSeoNaverSignals("수납 정리함", {
    credentials: { dataForSeoLogin: "login", dataForSeoPassword: "password", dataForSeoMaxCostUsd: 0.01 },
    request: async (_input, init) => {
      authorization = (init?.headers as Record<string, string>).Authorization;
      return response({ tasks: [{ cost: 0.0006, result: [{ items: [{ title: "정리함", url: "https://example.com/item", rank_absolute: 1 }] }] }] });
    },
  });
  assert.match(authorization, /^Basic /);
  assert.equal(result.observations[0]?.source, "dataforseo_naver");
  assert.equal(result.estimatedCostUsd, 0.0006);
  assert.equal(result.discoverySignals[0]?.sourceKind, "paid_api");
});

test("DataForSEO Google adapter retains only public Coupang offers with KRW prices", async () => {
  const result = await collectDataForSeoCoupangPrices("욕실 코너 선반", {
    credentials: { dataForSeoLogin: "login", dataForSeoPassword: "password", dataForSeoMaxCostUsd: 0.01 },
    request: async (_input, init) => {
      assert.match(String(init?.body), /욕실 코너 선반 쿠팡/);
      return response({ tasks: [{ cost: 0.002, result: [{ items: [
        { type: "organic", title: "쿠팡 욕실 코너 선반", url: "https://www.coupang.com/vp/products/1", domain: "coupang.com", rank_absolute: 1, price: { current: 12900, currency: "KRW" } },
        { type: "organic", title: "쿠팡 욕실 선반 특가", url: "https://www.coupang.com/vp/products/3", domain: "coupang.com", rank_absolute: 2, snippet: "현재 판매가 15,900원, 무료배송" },
        { type: "organic", title: "다른 판매처", url: "https://example.com/2", domain: "example.com", rank_absolute: 2, price: { current: 1000, currency: "KRW" } },
      ] }] }] });
    },
  });
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0]?.source, "coupang_public");
  assert.equal(result.observations[0]?.snapshot.price, 12_900);
  assert.equal(result.observations[1]?.snapshot.price, 15_900);
  assert.equal(result.estimatedCostUsd, 0.002);
});

test("missing credentials fail before any external request", async () => {
  let called = false;
  await assert.rejects(() => collectExternalMarketProvider("naver_shopping", "정리함", {
    credentials: {},
    request: async () => { called = true; return response({}); },
  }), /NAVER_CREDENTIALS_MISSING/);
  assert.equal(called, false);
});

test("native NAVER API HUB provider can be selected by the existing collector contract", async () => {
  const result = await collectConfiguredMarketObservations({
    collectorKey: "official-api-adapter",
    keyword: "정리함",
    provider: "naver_api_hub",
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    request: async () => response({ results: [{ data: [{ period: "2026-08-26", ratio: 42 }] }] }),
  });
  assert.equal(result.source, "naver_official");
  assert.equal(result.observations.length, 0);
  assert.equal(result.discoverySignals.length, 1);
});

test("YouTube cannot be silently persisted through the market snapshot contract", async () => {
  await assert.rejects(() => collectConfiguredMarketObservations({
    collectorKey: "public-observation-adapter",
    keyword: "정리함",
    provider: "youtube_data",
    credentials: { youtubeApiKey: "key" },
  }), /MARKET_PROVIDER_SIGNAL_ONLY/);
});
