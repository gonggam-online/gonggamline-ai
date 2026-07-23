import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

function parseNumber(
  value: string | null,
  defaultValue: number,
  minimum: number,
  maximum: number
) {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const keyword = params.get("keyword")?.trim() ?? "";
  const recommendation = params.get("recommendation")?.trim() ?? "";
  const reviewStatus = params.get("reviewStatus")?.trim() ?? "";
  const favoriteOnly = params.get("favoriteOnly") === "true";
  const page = parseNumber(params.get("page"), 1, 1, 100000);
  const size = parseNumber(params.get("size"), 20, 1, 100);
  const minimumScore = parseNumber(params.get("minimumScore"), 0, 0, 100);
  const sort = params.get("sort") ?? "score";

  const start = (page - 1) * size;
  const end = start + size - 1;

  try {
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .gte("basic_score", minimumScore);

    if (keyword) {
      const safeKeyword = keyword.replace(/[,%()]/g, " ");
      query = query.or(
        `title.ilike.%${safeKeyword}%,keyword.ilike.%${safeKeyword}%,product_no.ilike.%${safeKeyword}%`
      );
    }

    if (recommendation) query = query.eq("recommendation", recommendation);
    if (reviewStatus) query = query.eq("review_status", reviewStatus);
    if (favoriteOnly) query = query.eq("is_favorite", true);

    switch (sort) {
      case "profit":
        query = query
          .order("estimated_profit", { ascending: false })
          .order("basic_score", { ascending: false });
        break;
      case "margin":
        query = query
          .order("margin_rate", { ascending: false })
          .order("basic_score", { ascending: false });
        break;
      case "recent":
        query = query.order("updated_at", { ascending: false });
        break;
      case "price":
        query = query
          .order("supply_price", { ascending: true })
          .order("basic_score", { ascending: false });
        break;
      default:
        query = query
          .order("is_favorite", { ascending: false })
          .order("basic_score", { ascending: false })
          .order("estimated_profit", { ascending: false });
    }

    const { data, error, count } = await query.range(start, end);
    if (error) throw new Error(error.message);

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / size));

    return NextResponse.json({
      success: true,
      filters: {
        keyword,
        recommendation,
        reviewStatus,
        favoriteOnly,
        minimumScore,
        sort,
      },
      pagination: {
        page,
        size,
        totalCount,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      products: data ?? [],
    });
  } catch (error) {
    console.error("상품 조회 오류:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "상품 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
