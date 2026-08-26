import type { Metadata } from "next";

import { ItemSelectionAdmin } from "@/components/item-selection-admin/item-selection-admin";

export const metadata: Metadata = {
  title: "2. 상품선정·수익성 | 공감라인 AI",
  description: "판매 경쟁력과 수익성 근거를 평가하고 공급상품 선정 이력을 검토합니다.",
};

export default function ItemSelectionAdminPage() {
  return <ItemSelectionAdmin />;
}
