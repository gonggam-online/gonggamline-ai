import { NextResponse } from "next/server";
import { runAutomaticCompetitionAnalysis } from "@/features/competition/run-analysis";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ success: false, message: "유효하지 않은 상품 ID입니다." }, { status: 400 });
    }
    const result = await runAutomaticCompetitionAnalysis(productId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "자동 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
