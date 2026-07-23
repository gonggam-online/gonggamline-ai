import { coupangRequest, getCoupangConfig } from "@/lib/coupang/client";
import type { CoupangProductPayload } from "@/types/coupang";

export const COUPANG_LIVE_CONFIRMATION_TEXT = "실제 상품 등록";

export function attachVendorId(
  payload: CoupangProductPayload,
): CoupangProductPayload {
  const { vendorId } = getCoupangConfig();
  return { ...payload, vendorId };
}

export async function createCoupangProduct(payload: CoupangProductPayload) {
  return coupangRequest<Record<string, unknown>>({
    method: "POST",
    path: "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products",
    body: payload,
  });
}
