import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { AdminRequestGuardError, requireAdminRequest, requireExactAdminOrigin, requireJsonContentType } from "../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../lib/auth/admin-rate-limit.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "../../../../lib/auth/csrf.server";
import { createCollectionJob } from "../../../../services/market-orchestration.service";

export async function GET() {
  const { data, error } = await supabase.from("market_keywords").select("*").order("priority", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, keywords: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "market-keyword-write", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return NextResponse.json({ success: false, message: "요청 한도를 초과했습니다." }, { status: 429 });
    const body = await request.json();
    const keyword = String(body.keyword ?? "").trim();
    const category = String(body.category ?? "").trim();
    const priority = Math.max(1, Math.min(100, Number(body.priority ?? 50)));
    if (!keyword || keyword.length > 100 || category.length > 100 || !Number.isFinite(priority)) return NextResponse.json({ success: false, message: "키워드 입력값을 확인해주세요." }, { status: 400 });
    const { data, error } = await supabase.from("market_keywords").upsert({
      keyword,
      category: category || null,
      priority,
      collection_interval_minutes: 720,
      collection_status: "active",
    }, { onConflict: "keyword" }).select("*").single();
    if (error) throw error;
    await Promise.all([
      createCollectionJob({ collectorKey: "naver-shopping-api", keywordId: Number(data.id), intervalMinutes: 360, priority }),
      createCollectionJob({ collectorKey: "youtube-public-signals", keywordId: Number(data.id), intervalMinutes: 720, priority }),
      createCollectionJob({ collectorKey: "dataforseo-naver-serp", keywordId: Number(data.id), intervalMinutes: 1440, priority }),
    ]);
    return NextResponse.json({ success: true, keyword: data });
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) {
      return NextResponse.json({ error: { code: error.code } }, { status: error.status });
    }
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "키워드 저장 오류" }, { status: 500 });
  }
}
