const NO_DATA_RESPONSE = {
  success: true,
  available: false,
  products: [],
  message: "No data available",
} as const;

function parseNumber(
  value: string | null,
  defaultValue: number,
  minimum: number,
  maximum: number,
) {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function noDataResponse() {
  return Response.json(NO_DATA_RESPONSE, { status: 200 });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = {
      keyword: params.get("keyword")?.trim() ?? "",
      recommendation: params.get("recommendation")?.trim() ?? "",
      reviewStatus: params.get("reviewStatus")?.trim() ?? "",
      favoriteOnly: params.get("favoriteOnly") === "true",
      minimumScore: parseNumber(params.get("minimumScore"), 0, 0, 100),
      sort: params.get("sort") ?? "score",
    };
    const includeRevenueCalculation =
      params.get("includeRevenueCalculation") === "true";
    const includeRevenueScore =
      params.get("includeRevenueScore") === "true";
    const includeRanking = params.get("includeRanking") === "true";
    const page = parseNumber(params.get("page"), 1, 1, 100000);
    const size = parseNumber(params.get("size"), 20, 1, 100);
    const start = (page - 1) * size;
    const end = start + size - 1;

    const { listProducts } = await import("@/services/products.service");
    const result = await listProducts({ ...filters, start, end });
    if (!result.available) {
      return noDataResponse();
    }

    const totalPages = Math.max(1, Math.ceil(result.totalCount / size));
    let products = result.products;
    if (includeRevenueCalculation) {
      const { attachRevenueCalculations } = await import(
        "@/lib/revenue/calculation"
      );
      products = attachRevenueCalculations(products);
    }
    if (includeRevenueScore) {
      const { attachRevenueScores } = await import("@/lib/revenue/score");
      products = attachRevenueScores(products);
    }

    const response = {
      success: true,
      available: true,
      filters,
      pagination: {
        page,
        size,
        totalCount: result.totalCount,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      products,
    };
    if (includeRanking) {
      const { rankProductsByRevenue } = await import("@/lib/revenue/ranking");
      return Response.json({
        ...response,
        ranking: rankProductsByRevenue(result.products),
      });
    }
    return Response.json(response);
  } catch (error) {
    const { runtimeLog } = await import("@/lib/runtime-logging");
    runtimeLog.error("products.route_failed", error);
    return Response.json(
      { success: false, message: "상품 데이터를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
