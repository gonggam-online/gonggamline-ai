import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

type MarketMetric = { opportunity_score?: number | null };
type MarketProductWithMetrics = {
  market_product_metrics?: MarketMetric | MarketMetric[] | null;
};

function opportunityScore(product: MarketProductWithMetrics): number {
  const metrics = product.market_product_metrics;
  const metric = Array.isArray(metrics) ? metrics[0] : metrics;
  return Number(metric?.opportunity_score ?? 0);
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50)));
    const { data, error } = await supabase
      .from("market_products")
      .select("id,source,external_product_id,title,brand,seller_name,category,thumbnail_url,last_seen_at,market_product_metrics(*)")
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const products = (data ?? []).sort(
      (a: MarketProductWithMetrics, b: MarketProductWithMetrics) =>
        opportunityScore(b) - opportunityScore(a)
    );
    return NextResponse.json({ success: true, products });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 상품 조회 오류" }, { status: 500 });
  }
}
