import {
  buildRevenueDashboard,
  type RevenueDashboardQuery,
  type RevenueDashboardResponse,
} from "@/lib/revenue/dashboard";

const MAX_DASHBOARD_SOURCE_PRODUCTS = 10_000;

export async function queryRevenueDashboard(
  query: RevenueDashboardQuery,
): Promise<RevenueDashboardResponse> {
  const { listProducts } = await import("@/services/products.service");
  const result = await listProducts({
    keyword: query.keyword,
    recommendation: "",
    reviewStatus: "",
    favoriteOnly: false,
    minimumScore: 0,
    sort: "score",
    start: 0,
    end: MAX_DASHBOARD_SOURCE_PRODUCTS - 1,
  });

  return buildRevenueDashboard(result.available ? result.products : [], query);
}
