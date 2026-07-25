import {
  rankProductsByRevenue,
  type RevenueRankingReasonCode,
  type RevenueRankingResult,
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
  minRevenueScore: number | null;
};

export type RevenueDashboardDto = {
  rank: number;
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
  items: RevenueDashboardDto[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    returned: number;
    hasMore: boolean;
  };
  filters: {
    recommendationLevel: RevenueRecommendationLevel | null;
    status: RevenueScoreStatus | null;
    minRevenueScore: number | null;
  };
  meta: {
    generatedAt: string;
    engineVersion: null;
    rankingVersion: null;
    totalProducts: number;
  };
};

export type RevenueDashboardQueryError = {
  parameter: keyof RevenueDashboardQuery;
  message: string;
};

export type RevenueDashboardQueryParseResult =
  | { ok: true; value: RevenueDashboardQuery }
  | { ok: false; error: RevenueDashboardQueryError };

export function buildRevenueDashboardQueryError(
  error: RevenueDashboardQueryError,
) {
  return {
    error: {
      code: "INVALID_QUERY_PARAMETER" as const,
      message: error.message,
      details: { parameter: error.parameter },
    },
  };
}

function invalid(
  parameter: RevenueDashboardQueryError["parameter"],
  message: string,
): RevenueDashboardQueryParseResult {
  return { ok: false, error: { parameter, message } };
}

function parseInteger(
  params: URLSearchParams,
  parameter: "limit" | "offset",
  fallback: number,
  minimum: number,
  maximum: number,
): number | RevenueDashboardQueryParseResult {
  const raw = params.get(parameter);
  if (raw === null) return fallback;
  if (raw.trim() === "") {
    return invalid(
      parameter,
      `${parameter} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return invalid(
      parameter,
      `${parameter} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  return parsed;
}

function parseMinimumScore(
  params: URLSearchParams,
): number | null | RevenueDashboardQueryParseResult {
  const raw = params.get("minRevenueScore");
  if (raw === null) return null;
  if (raw.trim() === "") {
    return invalid(
      "minRevenueScore",
      "minRevenueScore must be a number from 0 to 100",
    );
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return invalid(
      "minRevenueScore",
      "minRevenueScore must be a number from 0 to 100",
    );
  }
  return parsed;
}

export function parseRevenueDashboardQuery(
  params: URLSearchParams,
): RevenueDashboardQueryParseResult {
  const limit = parseInteger(
    params,
    "limit",
    REVENUE_DASHBOARD_DEFAULT_LIMIT,
    1,
    REVENUE_DASHBOARD_MAX_LIMIT,
  );
  if (typeof limit !== "number") return limit;

  const offset = parseInteger(
    params,
    "offset",
    0,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  if (typeof offset !== "number") return offset;

  const rawRecommendation = params.get("recommendationLevel");
  if (
    rawRecommendation !== null
    && !RECOMMENDATION_LEVELS.has(
      rawRecommendation as RevenueRecommendationLevel,
    )
  ) {
    return invalid(
      "recommendationLevel",
      "recommendationLevel is not supported",
    );
  }

  const rawStatus = params.get("status");
  if (
    rawStatus !== null
    && !REVENUE_STATUSES.has(rawStatus as RevenueScoreStatus)
  ) {
    return invalid("status", "status is not supported");
  }

  const minRevenueScore = parseMinimumScore(params);
  if (
    typeof minRevenueScore === "object"
    && minRevenueScore !== null
    && "ok" in minRevenueScore
  ) {
    return minRevenueScore;
  }

  return {
    ok: true,
    value: {
      limit,
      offset,
      recommendationLevel:
        rawRecommendation as RevenueRecommendationLevel | null,
      status: rawStatus as RevenueScoreStatus | null,
      minRevenueScore,
    },
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

function compareNullableScore(
  left: number | null,
  right: number | null,
): number {
  return (right ?? Number.NEGATIVE_INFINITY)
    - (left ?? Number.NEGATIVE_INFINITY);
}

export function compareRevenueDashboardRanking(
  left: RevenueRankingResult,
  right: RevenueRankingResult,
): number {
  return right.rankingScore - left.rankingScore
    || compareNullableScore(left.revenueScore, right.revenueScore)
    || right.confidence - left.confidence
    || left.rank - right.rank
    || (left.productId ?? "").localeCompare(right.productId ?? "");
}

export function mapRevenueDashboardDto(
  ranking: RevenueRankingResult,
  lastAnalyzedAt: string | null,
): RevenueDashboardDto {
  return {
    rank: ranking.rank,
    productId: ranking.productId,
    productName: ranking.productName,
    rankingScore: ranking.rankingScore,
    revenueScore: ranking.revenueScore,
    recommendationLevel: ranking.recommendationLevel,
    confidence: ranking.confidence,
    reasonCodes: [...ranking.reasonCodes],
    status: ranking.status,
    lastAnalyzedAt,
  };
}

export function buildRevenueDashboard(
  products: readonly Record<string, unknown>[],
  query: RevenueDashboardQuery,
  options: { now?: Date } = {},
): RevenueDashboardResponse {
  const generatedAt = options.now ?? new Date();
  const analyzedAtByProductId = new Map<string, string | null>();
  for (const product of products) {
    const id = productIdentity(product);
    if (id !== null) analyzedAtByProductId.set(id, analyzedAt(product));
  }

  const rankings = rankProductsByRevenue(products, { now: generatedAt });
  const filtered = rankings
    .filter((item) =>
      query.recommendationLevel === null
      || item.recommendationLevel === query.recommendationLevel
    )
    .filter((item) => query.status === null || item.status === query.status)
    .filter((item) =>
      query.minRevenueScore === null
      || (
        item.revenueScore !== null
        && item.revenueScore >= query.minRevenueScore
      )
    )
    .sort(compareRevenueDashboardRanking);

  const page = filtered.slice(query.offset, query.offset + query.limit);
  const items = page.map((ranking) =>
    mapRevenueDashboardDto(
      ranking,
      ranking.productId === null
        ? null
        : analyzedAtByProductId.get(ranking.productId) ?? null,
    )
  );

  return {
    items,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: filtered.length,
      returned: items.length,
      hasMore: query.offset + items.length < filtered.length,
    },
    filters: {
      recommendationLevel: query.recommendationLevel,
      status: query.status,
      minRevenueScore: query.minRevenueScore,
    },
    meta: {
      generatedAt: generatedAt.toISOString(),
      engineVersion: null,
      rankingVersion: null,
      totalProducts: rankings.length,
    },
  };
}
