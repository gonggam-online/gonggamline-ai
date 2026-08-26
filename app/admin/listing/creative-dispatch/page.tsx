import type { Metadata } from "next";

import { ListingCreativeOperator } from "@/components/listing/listing-creative-operator";

export const metadata: Metadata = {
  title: "5-4. 이미지 생성·비공개 검토 | 공감라인 AI",
  description: "제한된 상품 콘텐츠 후보를 준비·생성하고 비공개 검토합니다.",
};

export default function ListingCreativeDispatchPage() {
  return <ListingCreativeOperator />;
}
