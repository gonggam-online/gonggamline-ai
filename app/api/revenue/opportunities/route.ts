import { NextRequest, NextResponse } from "next/server";
import { createOpportunity, listOpportunities } from "@/services/revenue-core.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const opportunities = await listOpportunities({
      status: params.get("status") || undefined,
      minimumScore: Number(params.get("minimumScore") || 0),
      keyword: params.get("keyword") || undefined,
    });
    return NextResponse.json({ success: true, opportunities });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "기회 조회 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!String(body.keyword || "").trim()) {
      return NextResponse.json({ success: false, message: "키워드는 필수입니다." }, { status: 400 });
    }
    return NextResponse.json({ success: true, opportunity: await createOpportunity(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "기회 생성 오류" }, { status: 500 });
  }
}
