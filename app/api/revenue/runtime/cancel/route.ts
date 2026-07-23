import { NextRequest, NextResponse } from "next/server";
import { cancelRuntimeJob } from "@/services/runtime-execution.service";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const id = typeof body === "object" && body !== null && "id" in body
      ? Number(body.id) : Number.NaN;
    return NextResponse.json({ success: true, job: await cancelRuntimeJob(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "작업 취소 오류";
    const status = message === "INVALID_JOB_ID" ? 400
      : message === "INVALID_JOB_TRANSITION" ? 409 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
