import type { RevenueRecommendationLevel } from "./ranking";
import type { RevenueScoreStatus } from "./score";

export type RevenueDashboardFilters = {
  keyword: string;
  recommendationLevel: RevenueRecommendationLevel | "";
  status: RevenueScoreStatus | "";
  minRevenueScore: string;
};

export const INITIAL_FILTERS: RevenueDashboardFilters = {
  keyword: "",
  recommendationLevel: "",
  status: "",
  minRevenueScore: "",
};

export type RevenueDashboardLocation = {
  filters: RevenueDashboardFilters;
  offset: number;
};

const recommendationValues = new Set([
  "STRONG_RECOMMEND",
  "RECOMMEND",
  "WATCH",
  "NOT_RECOMMENDED",
]);
const statusValues = new Set(["ready", "estimated", "incomplete", "invalid"]);

export function parseDashboardLocation(
  params: Pick<URLSearchParams, "get">,
): RevenueDashboardLocation {
  const recommendation = params.get("recommendationLevel") ?? "";
  const status = params.get("status") ?? "";
  const minimum = params.get("minRevenueScore") ?? "";
  const parsedOffset = Number(params.get("offset") ?? "0");
  return {
    filters: {
      keyword: (params.get("keyword") ?? "").trim().slice(0, 100),
      recommendationLevel: recommendationValues.has(recommendation)
        ? recommendation as RevenueDashboardFilters["recommendationLevel"]
        : "",
      status: statusValues.has(status)
        ? status as RevenueDashboardFilters["status"]
        : "",
      minRevenueScore:
        minimum !== "" && Number.isFinite(Number(minimum))
          && Number(minimum) >= 0 && Number(minimum) <= 100
          ? minimum
          : "",
    },
    offset: Number.isSafeInteger(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : 0,
  };
}

export function buildDashboardPageUrl(
  filters: RevenueDashboardFilters,
  offset: number,
  pageSize: number,
) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
  });
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.recommendationLevel) {
    params.set("recommendationLevel", filters.recommendationLevel);
  }
  if (filters.status) params.set("status", filters.status);
  if (filters.minRevenueScore !== "") {
    params.set("minRevenueScore", filters.minRevenueScore);
  }
  return `/dashboard/revenue?${params.toString()}`;
}
