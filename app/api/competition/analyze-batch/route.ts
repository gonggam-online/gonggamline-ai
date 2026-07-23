import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runAutomaticCompetitionAnalysis } from "@/features/competition/run-analysis";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(20, Math.max(1, Number(body.limit ?? 10)));
    const onlyPending = body.onlyPending !== false;
    let query = supabase.from("products").select("id").order("basic_score", { ascending: false }).limit(limit);
    if (onlyPending) query = query.in("competition_analysis_status", ["pending", "needs_data"]);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const results = [];
    for (const row of data ?? []) {
      try {
        const result = await runAutomaticCompetitionAnalysis(Number(row.id));
        results.push({ id: row.id, success: true, grade: result.analysis.grade, score: result.analysis.competitionScore, source: result.market.source });
      } catch (caught) {
        results.push({ id: row.id, success: false, message: caught instanceof Error ? caught.message : "분석 실패" });
      }
    }
    return NextResponse.json({ success: true, analyzedCount: results.filter((item) => item.success).length, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "일괄 분석 오류" }, { status: 500 });
  }
}
