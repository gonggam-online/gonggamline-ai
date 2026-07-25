import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildRevenueDashboard,
  buildRevenueDashboardQueryError,
  compareRevenueDashboardRanking,
  mapRevenueDashboardDto,
  parseRevenueDashboardQuery,
  REVENUE_DASHBOARD_DEFAULT_LIMIT,
  REVENUE_DASHBOARD_MAX_LIMIT,
  type RevenueDashboardQuery,
} from "../lib/revenue/dashboard.ts";
import type {
  RevenueRankingResult,
  RevenueRecommendationLevel,
} from "../lib/revenue/ranking.ts";
import type { RevenueScoreStatus } from "../lib/revenue/score.ts";

const NOW = new Date("2026-07-25T12:00:00.000Z");

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
    minRevenueScore: null,
    ...overrides,
  };
}

function parse(search = ""): RevenueDashboardQuery {
  const result = parseRevenueDashboardQuery(new URLSearchParams(search));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected valid query");
  return result.value;
}

function parseError(search: string, parameter: keyof RevenueDashboardQuery) {
  const result = parseRevenueDashboardQuery(new URLSearchParams(search));
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected invalid query");
  assert.equal(result.error.parameter, parameter);
  return result.error;
}

function ranking(
  overrides: Partial<RevenueRankingResult> = {},
): RevenueRankingResult {
  return {
    rank: 1,
    productId: "A",
    productName: "Product A",
    rankingScore: 80,
    revenueScore: 70,
    confidence: 0.8,
    reasonCodes: ["HIGH_MARGIN"],
    status: "ready",
    recommendationLevel: "RECOMMEND",
    rankingFactors: {
      competition: 100,
      confidence: 0.8,
      freshness: 100,
      dataCompleteness: 100,
      dataQuality: 100,
    },
    ...overrides,
  };
}

test("query defaults are exact", () => {
  assert.deepEqual(parse(), query({
    limit: REVENUE_DASHBOARD_DEFAULT_LIMIT,
  }));
});

test("accepts limit boundaries", () => {
  assert.equal(parse("limit=1").limit, 1);
  assert.equal(
    parse(`limit=${REVENUE_DASHBOARD_MAX_LIMIT}`).limit,
    REVENUE_DASHBOARD_MAX_LIMIT,
  );
});

test("rejects invalid limit values", () => {
  for (const value of ["invalid", "0", "101", "1.5", ""]) {
    parseError(`limit=${value}`, "limit");
  }
});

test("accepts non-negative integer offset", () => {
  assert.equal(parse("offset=0").offset, 0);
  assert.equal(parse("offset=25").offset, 25);
});

test("rejects invalid offset values", () => {
  for (const value of ["invalid", "-1", "1.5", ""]) {
    parseError(`offset=${value}`, "offset");
  }
});

test("accepts every recommendation level", () => {
  const values: RevenueRecommendationLevel[] = [
    "STRONG_RECOMMEND",
    "RECOMMEND",
    "WATCH",
    "NOT_RECOMMENDED",
  ];
  for (const value of values) {
    assert.equal(
      parse(`recommendationLevel=${value}`).recommendationLevel,
      value,
    );
  }
});

test("rejects unknown recommendation level", () => {
  parseError("recommendationLevel=UNKNOWN", "recommendationLevel");
});

test("accepts every Revenue status", () => {
  const values: RevenueScoreStatus[] = [
    "ready",
    "estimated",
    "incomplete",
    "invalid",
  ];
  for (const value of values) {
    assert.equal(parse(`status=${value}`).status, value);
  }
});

test("rejects unknown Revenue status", () => {
  parseError("status=unknown", "status");
});

test("accepts minimum score boundaries and decimals", () => {
  assert.equal(parse("minRevenueScore=0").minRevenueScore, 0);
  assert.equal(parse("minRevenueScore=70.5").minRevenueScore, 70.5);
  assert.equal(parse("minRevenueScore=100").minRevenueScore, 100);
});

test("rejects invalid minimum scores", () => {
  for (const value of ["invalid", "-1", "101", ""]) {
    parseError(`minRevenueScore=${value}`, "minRevenueScore");
  }
});

test("builds the required invalid-query error contract", () => {
  const error = parseError("limit=invalid", "limit");
  assert.deepEqual(buildRevenueDashboardQueryError(error), {
    error: {
      code: "INVALID_QUERY_PARAMETER",
      message: "limit must be an integer from 1 to 100",
      details: { parameter: "limit" },
    },
  });
});

test("response has items, pagination, filters, and meta only", () => {
  const response = buildRevenueDashboard([product("A")], query(), {
    now: NOW,
  });
  assert.deepEqual(Object.keys(response).sort(), [
    "filters",
    "items",
    "meta",
    "pagination",
  ]);
});

test("DTO hides internal Ranking fields", () => {
  const dto = mapRevenueDashboardDto(ranking(), null);
  assert.deepEqual(Object.keys(dto).sort(), [
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
  assert.equal(Object.hasOwn(dto, "rankingFactors"), false);
});

test("DTO copies reason codes without sharing the mutable array", () => {
  const source = ranking();
  const dto = mapRevenueDashboardDto(source, null);
  assert.deepEqual(dto.reasonCodes, source.reasonCodes);
  assert.notEqual(dto.reasonCodes, source.reasonCodes);
});

test("preserves global rank across pagination", () => {
  const all = buildRevenueDashboard(
    [product("A"), product("B"), product("C")],
    query(),
    { now: NOW },
  );
  const page = buildRevenueDashboard(
    [product("A"), product("B"), product("C")],
    query({ limit: 1, offset: 1 }),
    { now: NOW },
  );
  assert.equal(page.items[0].rank, all.items[1].rank);
});

test("sorts by ranking score first", () => {
  assert.ok(
    compareRevenueDashboardRanking(
      ranking({ rankingScore: 90 }),
      ranking({ rankingScore: 80 }),
    ) < 0,
  );
});

test("sorts equal ranking scores by revenue score", () => {
  assert.ok(
    compareRevenueDashboardRanking(
      ranking({ revenueScore: 90 }),
      ranking({ revenueScore: 80 }),
    ) < 0,
  );
});

test("sorts equal scores by confidence", () => {
  assert.ok(
    compareRevenueDashboardRanking(
      ranking({ confidence: 0.9 }),
      ranking({ confidence: 0.8 }),
    ) < 0,
  );
});

test("sorts equal metrics by global rank", () => {
  assert.ok(
    compareRevenueDashboardRanking(
      ranking({ rank: 1 }),
      ranking({ rank: 2 }),
    ) < 0,
  );
});

test("sorts final ties by product id", () => {
  assert.ok(
    compareRevenueDashboardRanking(
      ranking({ productId: "A" }),
      ranking({ productId: "B" }),
    ) < 0,
  );
});

test("filters use AND semantics", () => {
  const baseline = buildRevenueDashboard(
    [product("A"), product("B", { supply_price: null })],
    query(),
    { now: NOW },
  );
  const target = baseline.items[0];
  const response = buildRevenueDashboard(
    [product("A"), product("B", { supply_price: null })],
    query({
      recommendationLevel: target.recommendationLevel,
      status: target.status,
      minRevenueScore: target.revenueScore,
    }),
    { now: NOW },
  );
  assert.ok(response.items.every((item) =>
    item.recommendationLevel === target.recommendationLevel
    && item.status === target.status
    && item.revenueScore !== null
    && item.revenueScore >= (target.revenueScore ?? 0)
  ));
});

test("null minimum score retains null-score rankings", () => {
  const response = buildRevenueDashboard(
    [product("INVALID", { supply_price: -1 })],
    query({ minRevenueScore: null }),
    { now: NOW },
  );
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].revenueScore, null);
});

test("provided minimum score excludes null scores", () => {
  const response = buildRevenueDashboard(
    [product("INVALID", { supply_price: -1 })],
    query({ minRevenueScore: 0 }),
    { now: NOW },
  );
  assert.deepEqual(response.items, []);
});

test("pagination metadata uses filtered totals", () => {
  const response = buildRevenueDashboard(
    [product("A"), product("B"), product("C")],
    query({ limit: 2 }),
    { now: NOW },
  );
  assert.deepEqual(response.pagination, {
    limit: 2,
    offset: 0,
    total: 3,
    returned: 2,
    hasMore: true,
  });
});

test("empty results have stable pagination and meta", () => {
  const response = buildRevenueDashboard([], query(), { now: NOW });
  assert.deepEqual(response.items, []);
  assert.equal(response.pagination.total, 0);
  assert.equal(response.pagination.returned, 0);
  assert.equal(response.pagination.hasMore, false);
  assert.equal(response.meta.totalProducts, 0);
});

test("meta generatedAt is response generation time", () => {
  const response = buildRevenueDashboard([], query(), { now: NOW });
  assert.equal(response.meta.generatedAt, NOW.toISOString());
});

test("unknown engine versions remain null rather than invented", () => {
  const response = buildRevenueDashboard([], query(), { now: NOW });
  assert.equal(response.meta.engineVersion, null);
  assert.equal(response.meta.rankingVersion, null);
});

test("lastAnalyzedAt comes from source data", () => {
  const response = buildRevenueDashboard([product("A")], query(), {
    now: NOW,
  });
  assert.equal(
    response.items[0].lastAnalyzedAt,
    "2026-07-24T00:00:00.000Z",
  );
});

test("missing analysis time stays null and never uses current time", () => {
  const response = buildRevenueDashboard(
    [product("A", { competition_analyzed_at: null })],
    query(),
    { now: NOW },
  );
  assert.equal(response.items[0].lastAnalyzedAt, null);
});

test("response is finite, defined, and JSON serializable", () => {
  const response = buildRevenueDashboard([product("A")], query(), {
    now: NOW,
  });
  const json = JSON.stringify(response);
  assert.doesNotMatch(json, /NaN|Infinity|undefined/);
  assert.deepEqual(JSON.parse(json) as unknown, response);
});

test("source Product records are not mutated", () => {
  const products = [product("A")];
  const snapshot = structuredClone(products);
  buildRevenueDashboard(products, query(), { now: NOW });
  assert.deepEqual(products, snapshot);
});

test("route is read-only and delegates to the query service", async () => {
  const route = await readFile(
    new URL("../app/api/dashboard/revenue/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /queryRevenueDashboard\(parsed\.value\)/);
  assert.match(route, /status: 400/);
});
