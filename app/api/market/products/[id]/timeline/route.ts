import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) return NextResponse.json({ success: false, message: "유효하지 않은 상품 ID입니다." }, { status: 400 });
    const [{ data: product, error: productError }, { data: snapshots, error: snapshotError }, { data: signals, error: signalError }] = await Promise.all([
      supabase.from("market_products").select("*").eq("id", productId).single(),
      supabase.from("market_snapshots").select("observed_at,rank,price,rating,review_count,is_sold_out,delivery_days").eq("market_product_id", productId).order("observed_at", { ascending: true }).limit(1000),
      supabase.from("market_signals").select("*").eq("market_product_id", productId).order("detected_at", { ascending: false }).limit(50),
    ]);
    if (productError) throw productError;
    if (snapshotError) throw snapshotError;
    if (signalError) throw signalError;
    return NextResponse.json({ success: true, product, snapshots: snapshots ?? [], signals: signals ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시계열 조회 오류" }, { status: 500 });
  }
}
