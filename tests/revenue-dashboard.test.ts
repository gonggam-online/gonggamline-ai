import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildRevenueDashboard,
  parseRevenueDashboardQuery,
  REVENUE_DASHBOARD_DEFAULT_LIMIT,
  REVENUE_DASHBOARD_MAX_LIMIT,
  type RevenueDashboardQuery,
} from "../lib/revenue/dashboard.ts";

const NOW = new Date("2026-07-25T00:00:00.000Z");

function product(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    product_no: id,
    title: `Product ${id}`,
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
    ...overrides,
  };
}

function query(
  overrides: Partial<RevenueDashboardQuery> = {},
): RevenueDashboardQuery {
  return {
    limit: 20,
    offset: 0,
    recommendationLevel: null,
    status: null,
    minRevenueScore: 0,
    ...overrides,
  };
}

test("query parser applies dashboard defaults", () => {
  const parsed = parseRevenueDashboardQuery(new URLSearchParams());
  assert.equal(parsed.limit, REVENUE_DASHBOARD_DEFAULT_LIMIT);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.recommendationLevel, null);
  assert.equal(parsed.status, null);
  assert.equal(parsed.minRevenueScore, 0);
});

test("query parser accepts a valid limit", () => {
  assert.equal(
    parseRevenueDashboardQuery(new URLSearchParams("limit=7")).limit,
    7,
  );
});

test("query parser clamps limit to the maximum", () => {
  assert.equal(
    parseRevenueDashboardQuery(new URLSearchParams("limit=999")).limit,
    REVENUE_DASHBOARD_MAX_LIMIT,
  );
});

test("query parser clamps limit to one", () => {
  assert.equal(
    parseRevenueDashboardQuery(new URLSearchParams("limit=0")).limit,
    1,
  );
});

test("query parser floors fractional pagination values", () => {
  const parsed = parseRevenueDashboardQuery(
    new URLSearchParams("limit=3.9&offset=2.8"),
  );
  assert.equal(parsed.limit, 3);
  assert.equal(parsed.offset, 2);
});

test("query parser ignores invalid numeric values", () => {
  const parsed = parseRevenueDashboardQuery(
    new URLSearchParams("limit=nope&offset=nope&minRevenueScore=nope"),
  );
  assert.equal(parsed.limit, REVENUE_DASHBOARD_DEFAULT_LIMIT);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.minRevenueScore, 0);
});

test("query parser accepts recommendation level", () => {
  assert.equal(
    parseRevenueDashboardQuery(
      new URLSearchParams("recommendationLevel=RECOMMEND"),
    ).recommendationLevel,
    "RECOMMEND",
  );
});

test("query parser rejects unknown recommendation level", () => {
  assert.equal(
    parseRevenueDashboardQuery(
      new URLSearchParams("recommendationLevel=UNKNOWN"),
    ).recommendationLevel,
    null,
  );
});

test("query parser accepts status", () => {
  assert.equal(
    parseRevenueDashboardQuery(new URLSearchParams("status=estimated")).status,
    "estimated",
  );
});

test("query parser rejects unknown status", () => {
  assert.equal(
    parseRevenueDashboardQuery(new URLSearchParams("status=unknown")).status,
    null,
  );
});

test("query parser clamps minimum revenue score", () => {
  assert.equal(
    parseRevenueDashboardQuery(
      new URLSearchParams("minRevenueScore=150"),
    ).minRevenueScore,
    100,
  );
});

test("returns the dashboard response envelope", () => {
  const result = buildRevenueDashboard([product("A")], query(), { now: NOW });
  assert.equal(result.success, true);
  assert.equal(result.available, true);
  assert.deepEqual(result.filters, query());
  assert.equal(result.pagination.totalCount, 1);
});

test("returns the required product response contract", () => {
  const [item] = buildRevenueDashboard([product("A")], query(), {
    now: NOW,
  }).products;
  assert.deepEqual(Object.keys(item).sort(), [
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

test("reuses the Ranking Engine product identity", () => {
  const [item] = buildRevenueDashboard(
    [product("SKU-9", { title: "Desk lamp" })],
    query(),
    { now: NOW },
  ).products;
  assert.equal(item.productId, "SKU-9");
  assert.equal(item.productName, "Desk lamp");
});

test("exposes the stored analysis timestamp", () => {
  const [item] = buildRevenueDashboard([product("A")], query(), {
    now: NOW,
  }).products;
  assert.equal(item.lastAnalyzedAt, "2026-07-24T00:00:00.000Z");
});

test("does not invent a missing analysis timestamp", () => {
  const [item] = buildRevenueDashboard(
    [product("A", { competition_analyzed_at: null })],
    query(),
    { now: NOW },
  ).products;
  assert.equal(item.lastAnalyzedAt, null);
});

test("sorts dashboard products by ranking score descending", () => {
  const result = buildRevenueDashboard([
    product("LOW", { estimated_monthly_units_base: 5 }),
    product("HIGH", { estimated_monthly_units_base: 100 }),
  ], query(), { now: NOW });
  assert.equal(result.products[0].productId, "HIGH");
  assert.ok(
    result.products[0].rankingScore >= result.products[1].rankingScore,
  );
});

test("uses Ranking Engine rank as deterministic tie breaker", () => {
  const result = buildRevenueDashboard(
    [product("B"), product("A")],
    query(),
    { now: NOW },
  );
  assert.deepEqual(
    result.products.map(({ productId }) => productId),
    ["A", "B"],
  );
});

test("applies limit after ranking", () => {
  const result = buildRevenueDashboard(
    [product("A"), product("B"), product("C")],
    query({ limit: 2 }),
    { now: NOW },
  );
  assert.equal(result.products.length, 2);
  assert.equal(result.pagination.returnedCount, 2);
});

test("applies offset after ranking", () => {
  const all = buildRevenueDashboard(
    [product("A"), product("B"), product("C")],
    query(),
    { now: NOW },
  );
  const offset = buildRevenueDashboard(
    [product("A"), product("B"), product("C")],
    query({ offset: 1 }),
    { now: NOW },
  );
  assert.deepEqual(offset.products, all.products.slice(1));
});

test("reports next page when more filtered products remain", () => {
  const result = buildRevenueDashboard(
    [product("A"), product("B")],
    query({ limit: 1 }),
    { now: NOW },
  );
  assert.equal(result.pagination.hasNextPage, true);
});

test("reports no next page at the end", () => {
  const result = buildRevenueDashboard(
    [product("A"), product("B")],
    query({ limit: 1, offset: 1 }),
    { now: NOW },
  );
  assert.equal(result.pagination.hasNextPage, false);
});

test("returns an empty page for an offset beyond the result", () => {
  const result = buildRevenueDashboard(
    [product("A")],
    query({ offset: 10 }),
    { now: NOW },
  );
  assert.deepEqual(result.products, []);
  assert.equal(result.pagination.totalCount, 1);
});

test("filters by recommendation level", () => {
  const all = buildRevenueDashboard([
    product("STRONG"),
    product("INCOMPLETE", { supply_price: null }),
  ], query(), { now: NOW });
  const target = all.products[0].recommendationLevel;
  const filtered = buildRevenueDashboard(
    [product("STRONG"), product("INCOMPLETE", { supply_price: null })],
    query({ recommendationLevel: target }),
    { now: NOW },
  );
  assert.ok(
    filtered.products.every(
      ({ recommendationLevel }) => recommendationLevel === target,
    ),
  );
});

test("filters by score status", () => {
  const result = buildRevenueDashboard([
    product("READY"),
    product("INCOMPLETE", { supply_price: null }),
  ], query({ status: "incomplete" }), { now: NOW });
  assert.deepEqual(
    result.products.map(({ productId }) => productId),
    ["INCOMPLETE"],
  );
});

test("filters by minimum revenue score inclusively", () => {
  const all = buildRevenueDashboard(
    [product("A"), product("B", { estimated_monthly_units_base: 10 })],
    query(),
    { now: NOW },
  );
  const threshold = all.products[0].revenueScore ?? 0;
  const filtered = buildRevenueDashboard(
    [product("A"), product("B", { estimated_monthly_units_base: 10 })],
    query({ minRevenueScore: threshold }),
    { now: NOW },
  );
  assert.ok(
    filtered.products.every(
      ({ revenueScore }) => revenueScore !== null && revenueScore >= threshold,
    ),
  );
});

test("minimum revenue score excludes null scores", () => {
  const result = buildRevenueDashboard(
    [product("INVALID", { supply_price: -1 })],
    query(),
    { now: NOW },
  );
  assert.deepEqual(result.products, []);
});

test("combines recommendation, status, score, and pagination filters", () => {
  const products = [product("A"), product("B"), product("C")];
  const baseline = buildRevenueDashboard(products, query(), { now: NOW });
  const target = baseline.products[0];
  const result = buildRevenueDashboard(
    products,
    query({
      limit: 1,
      recommendationLevel: target.recommendationLevel,
      status: target.status,
      minRevenueScore: target.revenueScore ?? 0,
    }),
    { now: NOW },
  );
  assert.equal(result.products.length, 1);
});

test("does not mutate source products", () => {
  const products = [product("A")];
  const snapshot = structuredClone(products);
  buildRevenueDashboard(products, query(), { now: NOW });
  assert.deepEqual(products, snapshot);
});

test("Dashboard API route is read-only and calls the Ranking-backed builder", async () => {
  const route = await readFile(
    new URL("../app/api/dashboard/revenue/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /buildRevenueDashboard\(result\.products, query\)/);
});
