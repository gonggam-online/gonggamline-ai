import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: keywordCount }, { count: productCount }, { count: snapshotCount }, { data: alerts }] = await Promise.all([
      supabase.from("market_keywords").select("id", { count: "exact", head: true }),
      supabase.from("market_products").select("id", { count: "exact", head: true }),
      supabase.from("market_snapshots").select("id", { count: "exact", head: true }).gte("observed_at", since),
      supabase.from("market_signals").select("*").order("detected_at", { ascending: false }).limit(10),
    ]);
    return NextResponse.json({ success: true, summary: { keywordCount: keywordCount ?? 0, productCount: productCount ?? 0, snapshots24h: snapshotCount ?? 0, alerts: alerts ?? [] } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 요약 오류" }, { status: 500 });
  }
}
