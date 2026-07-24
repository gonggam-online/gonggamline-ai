import { NextResponse } from "next/server";
import { isExpectedReadUnavailableError, unavailableListResponse } from "@/lib/api-responses";
import { runtimeLog } from "@/lib/runtime-logging";
import { getSupabaseAvailability } from "@/lib/supabase";
import { listBundles } from "@/services/discovery.service";

export async function GET() {
  if (getSupabaseAvailability().status !== "configured") {
    return NextResponse.json(unavailableListResponse("bundles"));
  }
  try {
    return NextResponse.json({ success: true, available: true, bundles: await listBundles() });
  } catch (error) {
    runtimeLog.error("discovery.bundles_failed", error);
    if (isExpectedReadUnavailableError(error)) {
      return NextResponse.json(unavailableListResponse("bundles"));
    }
    return NextResponse.json(
      { success: false, message: "묶음 상품 데이터를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
