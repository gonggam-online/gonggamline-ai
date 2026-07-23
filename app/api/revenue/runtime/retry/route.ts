import { NextRequest, NextResponse } from "next/server";
import { retryRuntimeJob } from "@/services/runtime-execution.service";
export async function POST(request: NextRequest) {
  try { const body = await request.json(); return NextResponse.json({ success: true, job: await retryRuntimeJob(Number(body.id)) }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "재시도 오류" }, { status: 500 }); }
}
