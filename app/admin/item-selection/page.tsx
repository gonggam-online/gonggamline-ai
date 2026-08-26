import type { Metadata } from "next";

import { ItemSelectionAdmin } from "@/components/item-selection-admin/item-selection-admin";

export const metadata: Metadata = {
  title: "2. 상품선정·수익성 | 공감라인 AI",
  description: "판매 경쟁력과 수익성 근거를 평가하고 공급상품 선정 이력을 검토합니다.",
};

export default async function ItemSelectionAdminPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Readonly<{ keyword?: string | string[] }>>;
}>) {
  const value = (await searchParams).keyword;
  const initialKeyword = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";
  return <ItemSelectionAdmin initialKeyword={initialKeyword} />;
}
