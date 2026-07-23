import { NextRequest, NextResponse } from "next/server";
import { ensureCoupangRegistrationJob, getCoupangSellerDashboard } from "@/services/coupang-seller.service";

export async function GET() {
  try { return NextResponse.json({ success: true, ...(await getCoupangSellerDashboard()) }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "쿠팡 등록 작업 조회 실패" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const job = await ensureCoupangRegistrationJob(Number(body.listingDraftId));
    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "쿠팡 등록 작업 생성 실패" }, { status: 400 });
  }
}
