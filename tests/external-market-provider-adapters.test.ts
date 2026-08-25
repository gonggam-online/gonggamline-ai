import assert from "node:assert/strict";
import test from "node:test";

import {
  collectDataForSeoCoupangPrices,
  collectDataForSeoNaverSignals,
  collectExternalMarketProvider,
  collectNaverShopping,
  collectYouTubeVideoSignals,
} from "../lib/market/external-provider-adapters.ts";
import { collectConfiguredMarketObservations } from "../services/market-observation-collector.service.ts";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("Naver Shopping adapter uses official headers and returns sanitized observations", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await collectNaverShopping("수납 정리함", {
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    request: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return response({ items: [{ productId: "1", title: "<b>정리함</b>", link: "https://mall.example/item/1", lprice: "19900", hprice: "29900", mallName: "판매처" }] });
    },
  });
  assert.match(requestUrl, /openapi\.naver\.com\/v1\/search\/shop\.json/);
  assert.equal((requestInit?.headers as Record<string, string>)["X-Naver-Client-Id"], "client");
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.product.title, "정리함");
  assert.equal(result.observations[0]?.snapshot.price, 19900);
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

test("native Naver provider can be selected by the existing collector contract", async () => {
  const result = await collectConfiguredMarketObservations({
    collectorKey: "official-api-adapter",
    keyword: "정리함",
    provider: "naver_shopping",
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    request: async () => response({ items: [{ productId: "2", title: "정리함", link: "https://example.com", lprice: "1000" }] }),
  });
  assert.equal(result.source, "naver_official");
  assert.equal(result.observations.length, 1);
});

test("YouTube cannot be silently persisted through the market snapshot contract", async () => {
  await assert.rejects(() => collectConfiguredMarketObservations({
    collectorKey: "public-observation-adapter",
    keyword: "정리함",
    provider: "youtube_data",
    credentials: { youtubeApiKey: "key" },
  }), /MARKET_PROVIDER_SIGNAL_ONLY/);
});
