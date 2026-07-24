import { NextRequest, NextResponse } from "next/server";
import { isExpectedReadUnavailableError } from "@/lib/api-responses";
import { runtimeLog } from "@/lib/runtime-logging";
import { getSupabaseAvailability } from "@/lib/supabase";
import {
  ensureCoupangRegistrationJob,
  getCoupangSellerDashboard,
} from "@/services/coupang-seller.service";

export async function GET() {
  if (getSupabaseAvailability().status !== "configured") {
    return NextResponse.json({
      success: true,
      jobs: [],
      drafts: [],
      attempts: [],
    });
  }

  try {
    const dashboard = await getCoupangSellerDashboard();
    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    runtimeLog.error("coupang.seller_jobs_failed", error);

    if (isExpectedReadUnavailableError(error)) {
      return NextResponse.json({
        success: true,
        jobs: [],
        drafts: [],
        attempts: [],
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "쿠팡 등록 작업을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const job = await ensureCoupangRegistrationJob(Number(body.listingDraftId));
    return NextResponse.json({ success: true, job });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "쿠팡 등록 작업 생성 실패",
      },
      { status: 400 },
    );
  }
}
