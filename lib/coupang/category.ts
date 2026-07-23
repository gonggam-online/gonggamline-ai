import { coupangRequest } from "@/lib/coupang/client";
import type { CoupangCategoryMeta } from "@/types/coupang";

export function normalizeDisplayCategoryCode(value: unknown): string | null {
  const code = String(value ?? "").trim();
  return /^\d+$/.test(code) && Number(code) > 0 ? code : null;
}

export async function getCoupangCategoryMeta(displayCategoryCode: string) {
  const path = `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${displayCategoryCode}`;

  return coupangRequest<CoupangCategoryMeta>({
    method: "GET",
    path,
  });
}
