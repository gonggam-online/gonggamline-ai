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
import {
  NAVER_SHOPPING_CATEGORY_POLICY_VERSION,
  NAVER_SHOPPING_KEYWORD_CATEGORIES,
  resolveNaverShoppingCategory,
} from "../lib/market/naver-shopping-category-policy.ts";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
      return response({
        results: [
          {
            title: "수납 정리함",
            keywords: ["수납 정리함"],
            data: [
              { period: "2026-07-28", ratio: 40 },
              { period: "2026-08-26", ratio: 75 },
            ],
          },
        ],
      });
    },
  });
  assert.equal(
    requestUrl,
    "https://naverapihub.apigw.ntruss.com/search-trend/v1/search",
  );
  assert.equal(
    (requestInit?.headers as Record<string, string>)["X-NCP-APIGW-API-KEY-ID"],
    "client",
  );
  assert.equal(
    (requestInit?.headers as Record<string, string>)["X-NCP-APIGW-API-KEY"],
    "secret",
  );
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
    credentials: {
      naverClientId: "client",
      naverClientSecret: "secret",
      naverShoppingCategoryId: "50000004",
    },
    now: new Date("2026-08-26T00:00:00.000Z"),
    request: async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      if (String(input).includes("search-trend")) {
        return response({
          results: [{ data: [{ period: "2026-08-26", ratio: 60 }] }],
        });
      }
      return response({
        results: [{ data: [{ period: "2026-08-26", ratio: 80 }] }],
      });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1]?.url,
    "https://naverapihub.apigw.ntruss.com/shopping/v1/category/keywords",
  );
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

test("verified active keywords resolve to exact Naver Shopping category codes", () => {
  assert.equal(
    NAVER_SHOPPING_CATEGORY_POLICY_VERSION,
    "gonggamline-naver-shopping-category-policy-2026-08-26",
  );
  assert.equal(NAVER_SHOPPING_KEYWORD_CATEGORIES.length, 26);
  assert.deepEqual(
    Object.fromEntries(
      NAVER_SHOPPING_KEYWORD_CATEGORIES.map(({ keyword, categoryCode }) => [
        keyword,
        categoryCode,
      ]),
    ),
    {
      주방정리: "50000008",
      틈새수납: "50000004",
      케이블정리: "50000003",
      욕실정리: "50000008",
      먼지제거: "50000008",
      싱크대정리: "50000008",
      차량정리: "50000008",
      주방청소: "50000008",
      미끄럼방지: "50000008",
      냉장고정리: "50000008",
      다용도수납: "50000008",
      차량용수납: "50000008",
      정리용품: "50000008",
      소형조명: "50000004",
      다용도걸이: "50000008",
      차량청소: "50000008",
      여름쿨링: "50000007",
      생활보호용품: "50000008",
      겨울보온: "50000007",
      소형생활용품: "50000008",
      무선청소기: "50000003",
      장마용품: "50000008",
      캠핑수납: "50000007",
      여행정리: "50000001",
      휴대용보관: "50000008",
      생활용품: "50000008",
    },
  );
  assert.equal(
    resolveNaverShoppingCategory("  주방정리  ")?.categoryName,
    "생활/건강",
  );
  assert.equal(resolveNaverShoppingCategory("미등록 신규 키워드"), null);
});

test("NAVER API HUB automatically sends the keyword-specific verified Shopping Insight category", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const result = await collectNaverApiHubTrends("캠핑수납", {
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    now: new Date("2026-08-26T00:00:00.000Z"),
    request: async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return response({
        results: [{ data: [{ period: "2026-08-26", ratio: 55 }] }],
      });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.body.category, "50000007");
  assert.equal(result.discoverySignals[1]?.category, "50000007");
});

test("unknown keywords keep Search Trend but skip guessed Shopping Insight", async () => {
  const urls: string[] = [];
  const result = await collectNaverApiHubTrends("미등록 신규 키워드", {
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    request: async (input) => {
      urls.push(String(input));
      return response({
        results: [{ data: [{ period: "2026-08-26", ratio: 20 }] }],
      });
    },
  });
  assert.equal(urls.length, 1);
  assert.match(urls[0] ?? "", /search-trend/);
  assert.equal(result.requestCount, 1);
  assert.equal(result.discoverySignals.length, 1);
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
    request: async () =>
      response({
        items: [
          {
            id: { videoId: "video-1" },
            snippet: {
              title: "정리함 추천",
              publishedAt: "2026-08-19T00:00:00Z",
            },
          },
        ],
      }),
  });
  assert.equal(result.observations.length, 0);
  assert.equal(result.discoverySignals[0]?.sourceKind, "short_video_public");
  assert.equal(result.discoverySignals[0]?.assetRights, "UNKNOWN");
  assert.equal(result.discoverySignals[0]?.reviewCount, null);
});

test("YouTube adapter captures channel, short-form and public engagement metadata", async () => {
  const result = await collectYouTubeVideoSignals("정리함", {
    credentials: { youtubeApiKey: "key" },
    request: async (input) => {
      const url = String(input);
      if (url.includes("/search"))
        return response({
          items: [
            {
              id: { videoId: "video-1" },
              snippet: {
                title: "정리함 추천",
                publishedAt: "2026-08-19T00:00:00Z",
                channelId: "channel-1",
                channelTitle: "살림연구소",
                thumbnails: {
                  medium: { url: "https://img.example/video.jpg" },
                },
              },
            },
          ],
        });
      if (url.includes("/videos"))
        return response({
          items: [
            {
              id: "video-1",
              snippet: {
                channelId: "channel-1",
                channelTitle: "살림연구소",
                description: "회전 트레이 비교",
                tags: ["정리", "트레이"],
              },
              statistics: {
                viewCount: "150000",
                likeCount: "3200",
                commentCount: "90",
              },
              contentDetails: { duration: "PT42S" },
            },
          ],
        });
      return response({
        items: [
          {
            id: "channel-1",
            snippet: { country: "US" },
            statistics: { subscriberCount: "870" },
          },
        ],
      });
    },
  });
  assert.equal(result.requestCount, 3);
  assert.equal(result.discoverySignals[0]?.channelTitle, "살림연구소");
  assert.equal(result.discoverySignals[0]?.viewCount, 150_000);
  assert.equal(result.discoverySignals[0]?.subscriberCount, 870);
  assert.equal(result.discoverySignals[0]?.durationSeconds, 42);
  assert.equal(result.discoverySignals[0]?.isShort, true);
  assert.equal(result.discoverySignals[0]?.channelCountry, "US");
  assert.equal(result.discoverySignals[0]?.description, "회전 트레이 비교");
  assert.deepEqual(result.discoverySignals[0]?.tags, ["정리", "트레이"]);
});

test("DataForSEO Naver adapter maps paid SERP output without storing credentials", async () => {
  let authorization = "";
  const result = await collectDataForSeoNaverSignals("수납 정리함", {
    credentials: {
      dataForSeoLogin: "login",
      dataForSeoPassword: "password",
      dataForSeoMaxCostUsd: 0.01,
    },
    request: async (_input, init) => {
      authorization = (init?.headers as Record<string, string>).Authorization;
      return response({
        tasks: [
          {
            cost: 0.0006,
            result: [
              {
                items: [
                  {
                    title: "정리함",
                    url: "https://example.com/item",
                    rank_absolute: 1,
                  },
                ],
              },
            ],
          },
        ],
      });
    },
  });
  assert.match(authorization, /^Basic /);
  assert.equal(result.observations[0]?.source, "dataforseo_naver");
  assert.equal(result.estimatedCostUsd, 0.0006);
  assert.equal(result.discoverySignals[0]?.sourceKind, "paid_api");
});

test("DataForSEO Google adapter retains only public Coupang offers with KRW prices", async () => {
  const result = await collectDataForSeoCoupangPrices("욕실 코너 선반", {
    credentials: {
      dataForSeoLogin: "login",
      dataForSeoPassword: "password",
      dataForSeoMaxCostUsd: 0.01,
    },
    request: async (_input, init) => {
      assert.match(String(init?.body), /욕실 코너 선반 쿠팡/);
      assert.match(String(init?.body), /"depth":20/);
      return response({
        tasks: [
          {
            cost: 0.002,
            result: [
              {
                items: [
                  {
                    type: "organic",
                    title: "쿠팡 로켓그로스 욕실 코너 선반",
                    url: "https://www.coupang.com/vp/products/1",
                    domain: "coupang.com",
                    rank_absolute: 1,
                    price: { current: 12900, currency: "KRW" },
                    availability: "in stock",
                    reviews_count: 321,
                    product_rating: 4.7,
                  },
                  {
                    type: "organic",
                    title: "쿠팡 욕실 선반 특가",
                    url: "https://www.coupang.com/vp/products/3",
                    domain: "coupang.com",
                    rank_absolute: 2,
                    snippet: "현재 판매가 15,900원, 일시품절",
                  },
                  {
                    type: "organic",
                    title: "다른 판매처",
                    url: "https://example.com/2",
                    domain: "example.com",
                    rank_absolute: 2,
                    price: { current: 1000, currency: "KRW" },
                  },
                ],
              },
            ],
          },
        ],
      });
    },
  });
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0]?.source, "coupang_public");
  assert.equal(result.observations[0]?.snapshot.price, 12_900);
  assert.equal(result.observations[0]?.snapshot.isSoldOut, false);
  assert.equal(result.observations[0]?.snapshot.reviewCount, 321);
  assert.equal(result.observations[0]?.snapshot.rating, 4.7);
  assert.equal(result.observations[0]?.snapshot.rocketType, "rocket-growth");
  assert.equal(result.observations[1]?.snapshot.price, 15_900);
  assert.equal(result.observations[1]?.snapshot.isSoldOut, true);
  assert.equal(result.estimatedCostUsd, 0.002);
});

test("missing credentials fail before any external request", async () => {
  let called = false;
  await assert.rejects(
    () =>
      collectExternalMarketProvider("naver_shopping", "정리함", {
        credentials: {},
        request: async () => {
          called = true;
          return response({});
        },
      }),
    /NAVER_CREDENTIALS_MISSING/,
  );
  assert.equal(called, false);
});

test("native NAVER API HUB provider can be selected by the existing collector contract", async () => {
  const result = await collectConfiguredMarketObservations({
    collectorKey: "official-api-adapter",
    keyword: "정리함",
    provider: "naver_api_hub",
    credentials: { naverClientId: "client", naverClientSecret: "secret" },
    request: async () =>
      response({ results: [{ data: [{ period: "2026-08-26", ratio: 42 }] }] }),
  });
  assert.equal(result.source, "naver_official");
  assert.equal(result.observations.length, 0);
  assert.equal(result.discoverySignals.length, 1);
});

test("YouTube cannot be silently persisted through the market snapshot contract", async () => {
  await assert.rejects(
    () =>
      collectConfiguredMarketObservations({
        collectorKey: "public-observation-adapter",
        keyword: "정리함",
        provider: "youtube_data",
        credentials: { youtubeApiKey: "key" },
      }),
    /MARKET_PROVIDER_SIGNAL_ONLY/,
  );
});

test("an explicit orchestration opt-in admits YouTube discovery signals without observations", async () => {
  const result = await collectConfiguredMarketObservations({
    collectorKey: "public-observation-adapter",
    keyword: "주방정리",
    provider: "youtube_data",
    allowSignalOnly: true,
    credentials: { youtubeApiKey: "key" },
    request: async () =>
      response({
        items: [
          {
            id: { videoId: "video-1" },
            snippet: { title: "주방정리 공개 영상" },
          },
        ],
      }),
  });
  assert.equal(result.observations.length, 0);
  assert.equal(result.discoverySignals.length, 1);
  assert.equal(result.discoverySignals[0]?.sourceKind, "short_video_public");
});
