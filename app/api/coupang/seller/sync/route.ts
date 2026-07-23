import { NextResponse } from "next/server";
import { coupangRequest, getCoupangConfig } from "@/lib/coupang/client";
import { storeCoupangProductSnapshots } from "@/services/coupang-seller.service";

export async function POST() {
  try {
    const { vendorId } = getCoupangConfig();
    const searchParams = new URLSearchParams({ vendorId, maxPerPage: "100" });
    const result = await coupangRequest<Record<string, unknown>>({ method: "GET", path: "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products", searchParams });
    if (!result.ok) return NextResponse.json({ success: false, status: result.status, detail: result.raw }, { status: result.status });
    const data = result.data?.data;
    const products = Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
    const stored = await storeCoupangProductSnapshots(products);
    return NextResponse.json({ success: true, products, ...stored });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "쿠팡 상품 동기화 실패" }, { status: 500 });
  }
}
