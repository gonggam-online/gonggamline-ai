import { NextRequest, NextResponse } from "next/server";
import { importTenbiRows, parseTenbiCsv } from "../../../../lib/market/tenbi-import";
import { saveMarketObservation } from "../../../../services/market-observation.service";
import { supabase } from "../../../../lib/supabase";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { csv?: string; rows?: Record<string, unknown>[] };
    const result = importTenbiRows(body.rows ?? parseTenbiCsv(body.csv ?? ""));
    if (result.rows.length === 0) return NextResponse.json({ success: false, message: "유효한 Tenbi 행이 없습니다.", rejected: result.rejected }, { status: 400 });
    const history = await supabase.from("external_market_import_history").upsert({ source: "tenbi", source_digest: result.sourceDigest, accepted_count: result.rows.length, rejected_count: result.rejected.length, rejected_rows: result.rejected }, { onConflict: "source_digest", ignoreDuplicates: true }).select("id").maybeSingle();
    if (history.error && !/does not exist|schema cache/i.test(history.error.message)) throw history.error;
    const saved = [];
    for (const row of result.rows) saved.push(await saveMarketObservation(row));
    return NextResponse.json({ success: true, sourceDigest: result.sourceDigest, imported: saved.length, rejected: result.rejected, idempotent: Boolean(history.data === null && !history.error) });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Tenbi import 오류" }, { status: 500 }); }
}
