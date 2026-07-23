import { NextRequest, NextResponse } from "next/server";
import { retryRuntimeJob } from "@/services/runtime-execution.service";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const id = typeof body === "object" && body !== null && "id" in body
      ? Number(body.id) : Number.NaN;
    return NextResponse.json({ success: true, job: await retryRuntimeJob(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "작업 재시도 오류";
    const status = message === "INVALID_JOB_ID" ? 400
      : message === "JOB_NOT_FOUND" ? 404
      : ["INVALID_JOB_TRANSITION", "MAX_ATTEMPTS_REACHED"].includes(message) ? 409 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
