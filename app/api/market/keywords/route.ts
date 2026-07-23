import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabase.from("market_keywords").select("*").order("priority", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, keywords: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword = String(body.keyword ?? "").trim();
    if (!keyword) return NextResponse.json({ success: false, message: "키워드를 입력해주세요." }, { status: 400 });
    const { data, error } = await supabase.from("market_keywords").upsert({
      keyword,
      category: body.category || null,
      priority: Number(body.priority ?? 50),
      collection_interval_minutes: Number(body.collectionIntervalMinutes ?? 720),
      collection_status: "active",
    }, { onConflict: "keyword" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ success: true, keyword: data });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "키워드 저장 오류" }, { status: 500 });
  }
}
