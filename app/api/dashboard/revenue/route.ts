import {
  buildRevenueDashboard,
  parseRevenueDashboardQuery,
} from "@/lib/revenue/dashboard";

const MAX_DASHBOARD_SOURCE_PRODUCTS = 10_000;

export async function GET(request: Request) {
  try {
    const query = parseRevenueDashboardQuery(
      new URL(request.url).searchParams,
    );
    const { listProducts } = await import("@/services/products.service");
    const result = await listProducts({
      keyword: "",
      recommendation: "",
      reviewStatus: "",
      favoriteOnly: false,
      minimumScore: 0,
      sort: "score",
      start: 0,
      end: MAX_DASHBOARD_SOURCE_PRODUCTS - 1,
    });

    if (!result.available) {
      return Response.json({
        success: true,
        available: false,
        filters: query,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          totalCount: 0,
          returnedCount: 0,
          hasNextPage: false,
        },
        products: [],
        message: "No data available",
      });
    }

    return Response.json(buildRevenueDashboard(result.products, query));
  } catch (error) {
    const { runtimeLog } = await import("@/lib/runtime-logging");
    runtimeLog.error("dashboard.revenue_route_failed", error);
    return Response.json(
      { success: false, message: "Revenue dashboard data is unavailable" },
      { status: 500 },
    );
  }
}
