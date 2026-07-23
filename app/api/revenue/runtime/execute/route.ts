import { NextRequest, NextResponse } from "next/server";
import { executeNextRuntimeJob } from "@/services/runtime-execution.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(10, Number(body.limit || 1)));
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const result = await executeNextRuntimeJob();
      results.push(result);
      if (!result.executed) break;
    }
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Runtime 실행 오류" }, { status: 500 });
  }
}
