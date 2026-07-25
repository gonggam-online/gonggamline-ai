import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevenueDashboard,
  buildRevenueDashboardQueryError,
  type RevenueDashboardQuery,
} from "../lib/revenue/dashboard.ts";

const query: RevenueDashboardQuery = {
  limit: 20,
  offset: 0,
  recommendationLevel: null,
  status: null,
  minRevenueScore: null,
};

test("Revenue Dashboard success contract is stable", () => {
  const response = buildRevenueDashboard([{
    product_no: "P-1",
    title: "Contract product",
    estimated_sale_price: 50_000,
    supply_price: 10_000,
    marketplace_fee: 5_000,
    advertising_cost: 2_000,
    logistics_cost: 3_000,
    return_reserve: 0,
    estimated_monthly_units_base: 100,
    coupang_keyword_search_volume: 100_000,
    competition_score: 0,
    competition_analysis_status: "analyzed",
    competition_data_source: "external",
    competition_confidence: 100,
    competition_analyzed_at: "2026-07-24T00:00:00.000Z",
  }], query, { now: new Date("2026-07-25T12:00:00.000Z") });

  assert.deepEqual(Object.keys(response).sort(), [
    "filters",
    "items",
    "meta",
    "pagination",
  ]);
  assert.deepEqual(Object.keys(response.items[0]).sort(), [
    "confidence",
    "lastAnalyzedAt",
    "productId",
    "productName",
    "rank",
    "rankingScore",
    "reasonCodes",
    "recommendationLevel",
    "revenueScore",
    "status",
  ]);
  assert.deepEqual(Object.keys(response.pagination).sort(), [
    "hasMore",
    "limit",
    "offset",
    "returned",
    "total",
  ]);
  assert.deepEqual(Object.keys(response.filters).sort(), [
    "minRevenueScore",
    "recommendationLevel",
    "status",
  ]);
  assert.deepEqual(Object.keys(response.meta).sort(), [
    "engineVersion",
    "generatedAt",
    "rankingVersion",
    "totalProducts",
  ]);
});

test("Revenue Dashboard error contract is stable", () => {
  assert.deepEqual(
    buildRevenueDashboardQueryError({
      parameter: "limit",
      message: "limit must be an integer from 1 to 100",
    }),
    {
      error: {
        code: "INVALID_QUERY_PARAMETER",
        message: "limit must be an integer from 1 to 100",
        details: { parameter: "limit" },
      },
    },
  );
});
