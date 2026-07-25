import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateFreshnessScore,
  rankProductsByRevenue,
  REVENUE_RANKING_WEIGHTS,
} from "../lib/revenue/ranking.ts";

const NOW = new Date("2026-07-25T00:00:00.000Z");

function product(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    product_no: "P-1",
    title: "Reliable product",
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

test("ranking weights sum to one", () => {
  const total = Object.values(REVENUE_RANKING_WEIGHTS)
    .reduce((sum, weight) => sum + weight, 0);
  assert.ok(Math.abs(total - 1) < Number.EPSILON);
});

test("revenue score has the largest ranking weight", () => {
  assert.equal(REVENUE_RANKING_WEIGHTS.revenueScore, 0.6);
  assert.ok(
    Object.entries(REVENUE_RANKING_WEIGHTS)
      .filter(([name]) => name !== "revenueScore")
      .every(([, weight]) => weight < REVENUE_RANKING_WEIGHTS.revenueScore),
  );
});

test("ranks higher revenue value first", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "LOW", estimated_monthly_units_base: 10 }),
    product({ product_no: "HIGH" }),
  ], { now: NOW });
  assert.equal(ranked[0].productId, "HIGH");
});

test("assigns consecutive one-based ranks", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "B" }),
    product({ product_no: "A" }),
  ], { now: NOW });
  assert.deepEqual(ranked.map(({ rank }) => rank), [1, 2]);
});

test("returns product identity without changing it", () => {
  const [ranked] = rankProductsByRevenue([
    product({ product_no: "SKU-7", title: "Desk lamp" }),
  ], { now: NOW });
  assert.equal(ranked.productId, "SKU-7");
  assert.equal(ranked.productName, "Desk lamp");
});

test("does not mutate the input array or products", () => {
  const input = [product({ product_no: "B" }), product({ product_no: "A" })];
  const snapshot = structuredClone(input);
  rankProductsByRevenue(input, { now: NOW });
  assert.deepEqual(input, snapshot);
});

test("uses product id as a deterministic tie breaker", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "B" }),
    product({ product_no: "A" }),
  ], { now: NOW });
  assert.deepEqual(ranked.map(({ productId }) => productId), ["A", "B"]);
});

test("tie order is stable across input permutations", () => {
  const first = rankProductsByRevenue([
    product({ product_no: "C" }),
    product({ product_no: "A" }),
    product({ product_no: "B" }),
  ], { now: NOW });
  const second = rankProductsByRevenue([
    product({ product_no: "B" }),
    product({ product_no: "C" }),
    product({ product_no: "A" }),
  ], { now: NOW });
  assert.deepEqual(
    first.map(({ productId }) => productId),
    second.map(({ productId }) => productId),
  );
});

test("confidence raises otherwise equal ranking scores", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "LOW", competition_confidence: 50 }),
    product({ product_no: "HIGH", competition_confidence: 100 }),
  ], { now: NOW });
  assert.equal(ranked[0].productId, "HIGH");
});

test("invalid products sort below valid products", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "INVALID", supply_price: -1 }),
    product({ product_no: "VALID" }),
  ], { now: NOW });
  assert.equal(ranked.at(-1)?.productId, "INVALID");
  assert.equal(ranked.at(-1)?.status, "invalid");
});

test("incomplete products sort below estimated products", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "INCOMPLETE", supply_price: null }),
    product({
      product_no: "ESTIMATED",
      estimated_monthly_units_base: undefined,
    }),
  ], { now: NOW });
  assert.equal(ranked.at(-1)?.productId, "INCOMPLETE");
});

test("invalid products are retained", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "INVALID", supply_price: -1 }),
  ], { now: NOW });
  assert.equal(ranked.length, 1);
});

test("incomplete products are retained", () => {
  const ranked = rankProductsByRevenue([
    product({ product_no: "INCOMPLETE", supply_price: null }),
  ], { now: NOW });
  assert.equal(ranked.length, 1);
});

test("fresh data receives full freshness score", () => {
  assert.equal(calculateFreshnessScore("2026-07-20T00:00:00Z", NOW), 100);
});

test("data up to thirty days old receives reduced freshness", () => {
  assert.equal(calculateFreshnessScore("2026-07-01T00:00:00Z", NOW), 70);
});

test("data up to ninety days old receives low freshness", () => {
  assert.equal(calculateFreshnessScore("2026-05-01T00:00:00Z", NOW), 40);
});

test("stale data receives zero freshness", () => {
  assert.equal(calculateFreshnessScore("2026-01-01T00:00:00Z", NOW), 0);
});

test("missing or invalid analysis time remains missing", () => {
  assert.equal(calculateFreshnessScore(undefined, NOW), null);
  assert.equal(calculateFreshnessScore("not-a-date", NOW), null);
});

test("missing freshness is not replaced with an invented score", () => {
  const [ranked] = rankProductsByRevenue([
    product({ competition_analyzed_at: undefined }),
  ], { now: NOW });
  assert.equal(ranked.rankingFactors.freshness, null);
});

test("emits high-value positive reason codes from actual factors", () => {
  const [ranked] = rankProductsByRevenue([product()], { now: NOW });
  assert.ok(ranked.reasonCodes.includes("HIGH_MARGIN"));
  assert.ok(ranked.reasonCodes.includes("HIGH_DEMAND"));
  assert.ok(ranked.reasonCodes.includes("LOW_COMPETITION"));
});

test("emits LOW_CONFIDENCE only for low calculated confidence", () => {
  const [low] = rankProductsByRevenue([
    product({ competition_confidence: 20 }),
  ], { now: NOW });
  const [high] = rankProductsByRevenue([product()], { now: NOW });
  assert.ok(low.reasonCodes.includes("LOW_CONFIDENCE"));
  assert.ok(!high.reasonCodes.includes("LOW_CONFIDENCE"));
});

test("emits STALE_DATA only when actual analysis data is stale", () => {
  const [stale] = rankProductsByRevenue([
    product({ competition_analyzed_at: "2025-01-01T00:00:00Z" }),
  ], { now: NOW });
  const [missing] = rankProductsByRevenue([
    product({ competition_analyzed_at: undefined }),
  ], { now: NOW });
  assert.ok(stale.reasonCodes.includes("STALE_DATA"));
  assert.ok(!missing.reasonCodes.includes("STALE_DATA"));
});

test("emits MISSING_COST from Revenue Calculation evidence", () => {
  const [ranked] = rankProductsByRevenue([
    product({ supply_price: undefined }),
  ], { now: NOW });
  assert.ok(ranked.reasonCodes.includes("MISSING_COST"));
});

test("strong complete product is strongly recommended", () => {
  const [ranked] = rankProductsByRevenue([product()], { now: NOW });
  assert.equal(ranked.recommendationLevel, "STRONG_RECOMMEND");
});

test("complete product above watch threshold is not rejected", () => {
  const [ranked] = rankProductsByRevenue([
    product({
      supply_price: 20_000,
      estimated_monthly_units_base: 40,
      coupang_keyword_search_volume: 10_000,
      competition_score: 30,
    }),
  ], { now: NOW });
  assert.notEqual(ranked.recommendationLevel, "NOT_RECOMMENDED");
});

test("incomplete product is not recommended regardless of partial score", () => {
  const [ranked] = rankProductsByRevenue([
    product({ supply_price: undefined }),
  ], { now: NOW });
  assert.equal(ranked.recommendationLevel, "NOT_RECOMMENDED");
});

test("invalid product is not recommended", () => {
  const [ranked] = rankProductsByRevenue([
    product({ supply_price: -10 }),
  ], { now: NOW });
  assert.equal(ranked.recommendationLevel, "NOT_RECOMMENDED");
});

test("missing factor weight is not redistributed", () => {
  const [complete] = rankProductsByRevenue([product()], { now: NOW });
  const [missing] = rankProductsByRevenue([
    product({ competition_analyzed_at: undefined }),
  ], { now: NOW });
  assert.equal(
    complete.rankingScore - missing.rankingScore,
    REVENUE_RANKING_WEIGHTS.freshness * 100,
  );
});

test("ranking score stays within zero and one hundred", () => {
  const ranked = rankProductsByRevenue([
    product(),
    product({ product_no: "I", supply_price: -1 }),
  ], { now: NOW });
  assert.ok(ranked.every(({ rankingScore }) =>
    rankingScore >= 0 && rankingScore <= 100));
});

test("ranking DTO exposes explainability factors", () => {
  const [ranked] = rankProductsByRevenue([product()], { now: NOW });
  assert.deepEqual(Object.keys(ranked.rankingFactors), [
    "competition",
    "confidence",
    "freshness",
    "dataCompleteness",
    "dataQuality",
  ]);
});

test("API ranking is opt-in and preserves default response construction", async () => {
  const route = await readFile(
    new URL("../app/api/products/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /params\.get\("includeRanking"\) === "true"/);
  assert.match(route, /if \(includeRanking\)/);
  assert.match(route, /ranking: rankProductsByRevenue\(result\.products\)/);
  assert.match(route, /buildProductsApiResponse\(\{ base: baseResponse, products \}\)/);
});
