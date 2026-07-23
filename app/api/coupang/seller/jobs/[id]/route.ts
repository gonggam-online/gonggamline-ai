import { NextRequest, NextResponse } from "next/server";
import { updateCoupangJob, validateCoupangJob } from "@/services/coupang-seller.service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const jobId = Number(id);
    const job = body.action === "validate"
      ? await validateCoupangJob(jobId)
      : await updateCoupangJob({ id: jobId, action: body.action, sellerProductId: body.sellerProductId, coupangStatus: body.coupangStatus });
    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "쿠팡 등록 작업 변경 실패" }, { status: 400 });
  }
}
