import { NextResponse } from "next/server";
import { unavailableListResponse } from "@/lib/api-responses";
import { runtimeLog } from "@/lib/runtime-logging";
import { getSupabaseAvailability } from "@/lib/supabase";
import { listDecisionRuns } from "@/services/discovery.service";

export async function GET() {
  if (getSupabaseAvailability().status !== "configured") {
    return NextResponse.json(unavailableListResponse("runs"));
  }
  try {
    return NextResponse.json({ success: true, available: true, runs: await listDecisionRuns() });
  } catch (error) {
    runtimeLog.error("discovery.runs_failed", error);
    return NextResponse.json(
      { success: false, message: "의사결정 실행 이력을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
