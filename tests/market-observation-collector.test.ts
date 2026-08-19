import assert from "node:assert/strict";
import test from "node:test";
import { collectConfiguredMarketObservations } from "../services/market-observation-collector.service.ts";

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const observation = {
  observedAt: "2026-08-19T00:00:00.000Z",
  product: { externalProductId: "p-1", title: "테스트 상품", url: "https://example.test/p-1" },
  snapshot: { rank: 1, price: 12000, reviewCount: 30, isAd: false },
};

test("normalizes configured official observations and binds the approved source", async () => {
  const result = await collectConfiguredMarketObservations({
    collectorKey: "official-api-adapter",
    keyword: "테스트 키워드",
    endpoint: "https://provider.example/observe",
    request: async () => response(200, { observations: [observation] }),
  });
  assert.equal(result.source, "naver_official");
  assert.equal(result.observations[0]?.source, "naver_official");
  assert.equal(result.observations[0]?.keyword, "테스트 키워드");
});

test("fails closed when the provider is unavailable or rate limited", async () => {
  await assert.rejects(
    collectConfiguredMarketObservations({ collectorKey: "public-observation-adapter", keyword: "키워드" }),
    /MARKET_COLLECTOR_ENDPOINT_UNAVAILABLE/,
  );
  await assert.rejects(
    collectConfiguredMarketObservations({
      collectorKey: "public-observation-adapter",
      keyword: "키워드",
      endpoint: "https://provider.example/observe",
      request: async () => response(429, {}),
    }),
    /MARKET_COLLECTOR_RATE_LIMITED/,
  );
});

test("rejects malformed provider payloads instead of inventing facts", async () => {
  await assert.rejects(
    collectConfiguredMarketObservations({
      collectorKey: "official-api-adapter",
      keyword: "키워드",
      endpoint: "https://provider.example/observe",
      request: async () => response(200, { observations: [{ product: { title: "제목" }, snapshot: {} }] }),
    }),
    /MARKET_OBSERVATION_PRODUCT_INVALID/,
  );
});
