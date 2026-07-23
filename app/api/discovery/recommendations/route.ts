import { NextResponse } from "next/server";
import { unavailableListResponse } from "@/lib/api-responses";
import { runtimeLog } from "@/lib/runtime-logging";
import { getSupabaseAvailability } from "@/lib/supabase";
import { listRecommendations } from "@/services/discovery.service";

export async function GET() {
  if (getSupabaseAvailability().status !== "configured") {
    return NextResponse.json(unavailableListResponse("recommendations"));
  }
  try {
    return NextResponse.json({
      success: true, available: true, recommendations: await listRecommendations(),
    });
  } catch (error) {
    runtimeLog.error("discovery.recommendations_failed", error);
    return NextResponse.json(
      { success: false, message: "추천 데이터를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
