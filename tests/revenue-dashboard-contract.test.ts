import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevenueDashboard,
  type RevenueDashboardQuery,
} from "../lib/revenue/dashboard.ts";

const query: RevenueDashboardQuery = {
  limit: 20,
  offset: 0,
  recommendationLevel: null,
  status: null,
  minRevenueScore: 0,
};

test("Revenue Dashboard API contract is stable and JSON serializable", () => {
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
  }], query, { now: new Date("2026-07-25T00:00:00.000Z") });
  const serialized = JSON.parse(JSON.stringify(response)) as unknown;

  assert.deepEqual(serialized, response);
  assert.deepEqual(Object.keys(response).sort(), [
    "available",
    "filters",
    "pagination",
    "products",
    "success",
  ]);
  assert.deepEqual(Object.keys(response.products[0]).sort(), [
    "confidence",
    "lastAnalyzedAt",
    "productId",
    "productName",
    "rankingScore",
    "reasonCodes",
    "recommendationLevel",
    "revenueScore",
    "status",
  ]);
});
