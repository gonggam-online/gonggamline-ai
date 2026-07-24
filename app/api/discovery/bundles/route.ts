import { NextResponse } from "next/server";
import { resolveReadErrorResponse, unavailableListResponse } from "@/lib/api-responses";
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
    const response = resolveReadErrorResponse(
      error,
      unavailableListResponse("bundles"),
      "묶음 상품 데이터를 불러오지 못했습니다.",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
