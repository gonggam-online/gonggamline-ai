import { NextRequest, NextResponse } from "next/server";
import { createCollectionJob, listCollectorState } from "../../../../services/market-orchestration.service";

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await listCollectorState()) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "작업 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.collectorKey || !Number(body.keywordId)) {
      return NextResponse.json({ success: false, message: "collectorKey와 keywordId가 필요합니다." }, { status: 400 });
    }
    const job = await createCollectionJob({ collectorKey: body.collectorKey, keywordId: Number(body.keywordId), intervalMinutes: Number(body.intervalMinutes || 720), priority: Number(body.priority || 50) });
    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "작업 저장 실패" }, { status: 500 });
  }
}
