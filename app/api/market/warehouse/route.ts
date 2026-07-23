import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function GET() {
  try {
    const [{ count: features }, { count: feedback }, { data: top }, { data: grades }] = await Promise.all([
      supabase.from("market_feature_snapshots").select("id", { count: "exact", head: true }),
      supabase.from("market_feedback_events").select("id", { count: "exact", head: true }),
      supabase.from("market_product_metrics").select("market_product_id,opportunity_score,entry_difficulty_score,supply_score,data_completeness_score,recommendation_grade").order("opportunity_score", { ascending: false }).limit(5),
      supabase.from("market_product_metrics").select("recommendation_grade"),
    ]);
    const gradeCounts = (grades ?? []).reduce<Record<string, number>>((acc, row) => { const key=row.recommendation_grade ?? "-"; acc[key]=(acc[key]??0)+1; return acc; }, {});
    return NextResponse.json({ success: true, warehouse: { featureSnapshots: features ?? 0, feedbackEvents: feedback ?? 0, top: top ?? [], gradeCounts } });
  } catch (error) { return NextResponse.json({ success:false, message:error instanceof Error?error.message:"웨어하우스 조회 오류" }, { status:500 }); }
}
