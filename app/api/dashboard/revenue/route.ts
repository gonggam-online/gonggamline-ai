import {
  buildRevenueDashboardQueryError,
  parseRevenueDashboardQuery,
} from "@/lib/revenue/dashboard";

export async function GET(request: Request) {
  const parsed = parseRevenueDashboardQuery(
    new URL(request.url).searchParams,
  );
  if (!parsed.ok) {
    return Response.json(
      buildRevenueDashboardQueryError(parsed.error),
      { status: 400 },
    );
  }

  try {
    const { queryRevenueDashboard } = await import(
      "@/services/revenue-dashboard.service"
    );
    return Response.json(await queryRevenueDashboard(parsed.value));
  } catch (error) {
    const { runtimeLog } = await import("@/lib/runtime-logging");
    runtimeLog.error("dashboard.revenue_route_failed", error);
    return Response.json(
      {
        error: {
          code: "REVENUE_DASHBOARD_UNAVAILABLE",
          message: "Revenue dashboard data is unavailable",
        },
      },
      { status: 500 },
    );
  }
}
