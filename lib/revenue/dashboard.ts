import {
  rankProductsByRevenue,
  type RevenueRankingReasonCode,
  type RevenueRecommendationLevel,
} from "./ranking.ts";
import type { RevenueScoreStatus } from "./score.ts";

export const REVENUE_DASHBOARD_DEFAULT_LIMIT = 20;
export const REVENUE_DASHBOARD_MAX_LIMIT = 100;

const RECOMMENDATION_LEVELS = new Set<RevenueRecommendationLevel>([
  "STRONG_RECOMMEND",
  "RECOMMEND",
  "WATCH",
  "NOT_RECOMMENDED",
]);

const REVENUE_STATUSES = new Set<RevenueScoreStatus>([
  "ready",
  "estimated",
  "incomplete",
  "invalid",
]);

export type RevenueDashboardQuery = {
  limit: number;
  offset: number;
  recommendationLevel: RevenueRecommendationLevel | null;
  status: RevenueScoreStatus | null;
  minRevenueScore: number;
};

export type RevenueDashboardProduct = {
  productId: string | null;
  productName: string | null;
  rankingScore: number;
  revenueScore: number | null;
  recommendationLevel: RevenueRecommendationLevel;
  confidence: number;
  reasonCodes: RevenueRankingReasonCode[];
  status: RevenueScoreStatus;
  lastAnalyzedAt: string | null;
};

export type RevenueDashboardResponse = {
  success: true;
  available: true;
  filters: RevenueDashboardQuery;
  pagination: {
    limit: number;
    offset: number;
    totalCount: number;
    returnedCount: number;
    hasNextPage: boolean;
  };
  products: RevenueDashboardProduct[];
};

function boundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function boundedScore(value: string | null): number {
  if (value === null || value.trim() === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function recommendationFilter(
  value: string | null,
): RevenueRecommendationLevel | null {
  return value !== null
      && RECOMMENDATION_LEVELS.has(value as RevenueRecommendationLevel)
    ? value as RevenueRecommendationLevel
    : null;
}

function statusFilter(value: string | null): RevenueScoreStatus | null {
  return value !== null && REVENUE_STATUSES.has(value as RevenueScoreStatus)
    ? value as RevenueScoreStatus
    : null;
}

export function parseRevenueDashboardQuery(
  params: URLSearchParams,
): RevenueDashboardQuery {
  return {
    limit: boundedInteger(
      params.get("limit"),
      REVENUE_DASHBOARD_DEFAULT_LIMIT,
      1,
      REVENUE_DASHBOARD_MAX_LIMIT,
    ),
    offset: boundedInteger(params.get("offset"), 0, 0, 1_000_000),
    recommendationLevel: recommendationFilter(
      params.get("recommendationLevel"),
    ),
    status: statusFilter(params.get("status")),
    minRevenueScore: boundedScore(params.get("minRevenueScore")),
  };
}

function productIdentity(product: Record<string, unknown>): string | null {
  for (const key of ["product_no", "id"]) {
    const value = product[key];
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function analyzedAt(product: Record<string, unknown>): string | null {
  const value = product.competition_analyzed_at;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function buildRevenueDashboard(
  products: readonly Record<string, unknown>[],
  query: RevenueDashboardQuery,
  options: { now?: Date } = {},
): RevenueDashboardResponse {
  const analyzedAtByProductId = new Map<string, string | null>();
  for (const product of products) {
    const id = productIdentity(product);
    if (id !== null) analyzedAtByProductId.set(id, analyzedAt(product));
  }

  const filtered = rankProductsByRevenue(products, options)
    .filter((product) =>
      query.recommendationLevel === null
      || product.recommendationLevel === query.recommendationLevel
    )
    .filter((product) =>
      query.status === null || product.status === query.status
    )
    .filter((product) =>
      product.revenueScore !== null
      && product.revenueScore >= query.minRevenueScore
    )
    .sort((left, right) =>
      right.rankingScore - left.rankingScore || left.rank - right.rank
    );

  const page = filtered.slice(query.offset, query.offset + query.limit);
  const dashboardProducts = page.map(
    ({
      productId,
      productName,
      rankingScore,
      revenueScore,
      recommendationLevel,
      confidence,
      reasonCodes,
      status,
    }): RevenueDashboardProduct => ({
      productId,
      productName,
      rankingScore,
      revenueScore,
      recommendationLevel,
      confidence,
      reasonCodes,
      status,
      lastAnalyzedAt:
        productId === null ? null : analyzedAtByProductId.get(productId) ?? null,
    }),
  );

  return {
    success: true,
    available: true,
    filters: query,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      totalCount: filtered.length,
      returnedCount: dashboardProducts.length,
      hasNextPage: query.offset + dashboardProducts.length < filtered.length,
    },
    products: dashboardProducts,
  };
}
