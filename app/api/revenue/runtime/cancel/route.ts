import { NextRequest, NextResponse } from "next/server";
import { cancelRuntimeJob } from "@/services/runtime-execution.service";
export async function POST(request: NextRequest) {
  try { const body = await request.json(); return NextResponse.json({ success: true, job: await cancelRuntimeJob(Number(body.id)) }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "취소 오류" }, { status: 500 }); }
}
