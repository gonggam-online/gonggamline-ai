import assert from "node:assert/strict";
import test from "node:test";
import { rankProductsByRevenue } from "../lib/revenue/ranking.ts";
import { attachRevenueScores } from "../lib/revenue/score.ts";
import { buildProductsApiResponse } from "../lib/revenue/products-api-response.ts";

const baseProduct = {
  id: 7,
  product_no: "SKU-7",
  title: "Contract fixture",
  estimated_sale_price: 50_000,
  supply_price: 10_000,
  marketplace_fee: 5_000,
  advertising_cost: 2_000,
  logistics_cost: 3_000,
  return_reserve: 0,
  estimated_monthly_units_low: 100,
  estimated_monthly_units_high: 100,
  estimated_monthly_units_base: 100,
  coupang_keyword_search_volume: 100_000,
  competition_score: 0,
  competition_analysis_status: "analyzed",
  competition_data_source: "external",
  competition_confidence: 100,
  competition_analyzed_at: "2026-07-24T00:00:00.000Z",
};

const base = {
  success: true as const,
  available: true as const,
  filters: {
    keyword: "",
    recommendation: "",
    reviewStatus: "",
    favoriteOnly: false,
    minimumScore: 0,
    sort: "score",
  },
  pagination: {
    page: 1,
    size: 20,
    totalCount: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
};

function omitKey(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([entryKey]) => entryKey !== key),
  );
}

test("default Products API response preserves the legacy contract", () => {
  const response = buildProductsApiResponse({
    base,
    products: [baseProduct],
  });

  assert.deepEqual(Object.keys(response).sort(), [
    "available",
    "filters",
    "pagination",
    "products",
    "success",
  ]);
  assert.deepEqual(response.products, [baseProduct]);
  assert.equal(Object.hasOwn(response, "ranking"), false);
  assert.equal(Object.hasOwn(response.products[0], "revenueScore"), false);
});

test("Revenue Score opt-in only adds revenueScore to each product", () => {
  const defaultResponse = buildProductsApiResponse({
    base,
    products: [baseProduct],
  });
  const scoredResponse = buildProductsApiResponse({
    base,
    products: attachRevenueScores([baseProduct]),
  });

  assert.deepEqual(
    omitKey(scoredResponse.products[0], "revenueScore"),
    defaultResponse.products[0],
  );
  assert.equal(Object.hasOwn(scoredResponse.products[0], "revenueScore"), true);
  assert.deepEqual(
    omitKey(scoredResponse, "products"),
    omitKey(defaultResponse, "products"),
  );
  assert.equal(Object.hasOwn(scoredResponse, "ranking"), false);
});

test("Ranking opt-in only adds the top-level ranking field", () => {
  const defaultResponse = buildProductsApiResponse({
    base,
    products: [baseProduct],
  });
  const rankingResponse = buildProductsApiResponse({
    base,
    products: [baseProduct],
    ranking: rankProductsByRevenue([baseProduct], {
      now: new Date("2026-07-25T00:00:00.000Z"),
    }),
  });

  assert.deepEqual(
    omitKey(rankingResponse, "ranking"),
    defaultResponse,
  );
  assert.ok("ranking" in rankingResponse);
  assert.equal(Array.isArray(rankingResponse.ranking), true);
  assert.equal(Object.hasOwn(rankingResponse.products[0], "revenueScore"), false);
});

test("Revenue Score and Ranking opt-ins compose without changing base fields", () => {
  const defaultResponse = buildProductsApiResponse({
    base,
    products: [baseProduct],
  });
  const combinedResponse = buildProductsApiResponse({
    base,
    products: attachRevenueScores([baseProduct]),
    ranking: rankProductsByRevenue([baseProduct], {
      now: new Date("2026-07-25T00:00:00.000Z"),
    }),
  });

  assert.deepEqual(
    omitKey(combinedResponse.products[0], "revenueScore"),
    defaultResponse.products[0],
  );
  assert.deepEqual(
    omitKey(omitKey(combinedResponse, "ranking"), "products"),
    omitKey(defaultResponse, "products"),
  );
  assert.equal(Object.hasOwn(combinedResponse.products[0], "revenueScore"), true);
  assert.ok("ranking" in combinedResponse);
  assert.equal(Array.isArray(combinedResponse.ranking), true);
});
