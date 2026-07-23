import { NextRequest, NextResponse } from "next/server";
import { NO_DATA_MESSAGE } from "@/lib/runtime-errors";
import { listProducts } from "@/services/products.service";

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

function emptyProductsResponse(
  filters: {
    keyword: string;
    recommendation: string;
    reviewStatus: string;
    favoriteOnly: boolean;
    minimumScore: number;
    sort: string;
  },
  page: number,
  size: number,
) {
  return NextResponse.json({
    success: true,
    available: false,
    message: NO_DATA_MESSAGE,
    filters,
    pagination: {
      page,
      size,
      totalCount: 0,
      totalPages: 1,
      hasPreviousPage: page > 1,
      hasNextPage: false,
    },
    products: [],
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = {
    keyword: params.get("keyword")?.trim() ?? "",
    recommendation: params.get("recommendation")?.trim() ?? "",
    reviewStatus: params.get("reviewStatus")?.trim() ?? "",
    favoriteOnly: params.get("favoriteOnly") === "true",
    minimumScore: parseNumber(params.get("minimumScore"), 0, 0, 100),
    sort: params.get("sort") ?? "score",
  };
  const page = parseNumber(params.get("page"), 1, 1, 100000);
  const size = parseNumber(params.get("size"), 20, 1, 100);
  const start = (page - 1) * size;
  const end = start + size - 1;

  try {
    const result = await listProducts({ ...filters, start, end });
    if (!result.available) {
      return emptyProductsResponse(filters, page, size);
    }

    const totalPages = Math.max(1, Math.ceil(result.totalCount / size));
    return NextResponse.json({
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
      products: result.products,
    });
  } catch (error) {
    console.error("Product query unavailable:", error);
    return emptyProductsResponse(filters, page, size);
  }
}
