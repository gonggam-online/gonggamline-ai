import { NextRequest, NextResponse } from "next/server";
import { coupangRequest, getCoupangConfig } from "@/lib/coupang/client";

export async function GET(request: NextRequest) {
  try {
    const { vendorId } = getCoupangConfig();
    const requestedSize = Number(request.nextUrl.searchParams.get("size") ?? "20");
    const maxPerPage = String(Math.min(100, Math.max(1, requestedSize)));
    const businessType = request.nextUrl.searchParams.get("businessType");
    const nextToken = request.nextUrl.searchParams.get("nextToken");

    const searchParams = new URLSearchParams({ vendorId, maxPerPage });
    if (businessType === "rocketGrowth") searchParams.set("businessTypes", "rocketGrowth");
    if (nextToken) searchParams.set("nextToken", nextToken);

    const result = await coupangRequest<Record<string, unknown>>({
      method: "GET",
      path: "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products",
      searchParams,
    });

    return NextResponse.json(
      result.ok
        ? { ok: true, result: result.data }
        : { ok: false, status: result.status, detail: result.raw },
      { status: result.ok ? 200 : result.status },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "상품 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
