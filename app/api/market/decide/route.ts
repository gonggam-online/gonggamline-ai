import { NextRequest, NextResponse } from "next/server";
import { analyzeAndDecide } from "../../../../services/market-orchestration.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = Number(body.productId);
    if (!productId) return NextResponse.json({ success: false, message: "productId가 필요합니다." }, { status: 400 });
    const result = await analyzeAndDecide(productId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "AI 판단 실패" }, { status: 500 });
  }
}
