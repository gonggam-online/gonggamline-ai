import { NextRequest, NextResponse } from "next/server";
import { runDueCollectionJobs } from "../../../../../services/market-orchestration.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runDueCollectionJobs(Math.min(100, Math.max(1, Number(body.limit || 20))));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "스케줄 실행 실패" }, { status: 500 });
  }
}
