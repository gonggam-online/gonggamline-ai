export type ProductSort =
  | "score"
  | "profit"
  | "margin"
  | "recent"
  | "price";

export type ProductQuery = {
  keyword: string;
  recommendation: string;
  reviewStatus: string;
  favoriteOnly: boolean;
  minimumScore: number;
  sort: string;
  start: number;
  end: number;
};

export type ProductQueryResult = {
  products: Record<string, unknown>[];
  totalCount: number;
  available: boolean;
};

export async function listProducts(
  filters: ProductQuery,
): Promise<ProductQueryResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { products: [], totalCount: 0, available: false };
  }

  let supabase: typeof import("@/lib/supabase").supabase;
  try {
    ({ supabase } = await import("@/lib/supabase"));
  } catch (error) {
    console.error("Supabase client unavailable:", error);
    return { products: [], totalCount: 0, available: false };
  }

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .gte("basic_score", filters.minimumScore);

  if (filters.keyword) {
    const safeKeyword = filters.keyword.replace(/[,%()]/g, " ");
    query = query.or(
      `title.ilike.%${safeKeyword}%,keyword.ilike.%${safeKeyword}%,product_no.ilike.%${safeKeyword}%`,
    );
  }

  if (filters.recommendation) {
    query = query.eq("recommendation", filters.recommendation);
  }
  if (filters.reviewStatus) {
    query = query.eq("review_status", filters.reviewStatus);
  }
  if (filters.favoriteOnly) {
    query = query.eq("is_favorite", true);
  }

  switch (filters.sort as ProductSort) {
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

  try {
    const { data, error, count } = await query.range(filters.start, filters.end);
    if (error) {
      console.error("Supabase product query unavailable:", error.message);
      return { products: [], totalCount: 0, available: false };
    }

    return {
      products: (data ?? []) as Record<string, unknown>[],
      totalCount: count ?? 0,
      available: true,
    };
  } catch (error) {
    console.error("Supabase product request unavailable:", error);
    return { products: [], totalCount: 0, available: false };
  }
}
