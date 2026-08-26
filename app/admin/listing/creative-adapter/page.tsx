import type { Metadata } from "next";

import { ListingCreativeAdapterExport } from "@/components/listing/listing-creative-adapter-export";

export const metadata: Metadata = {
  title: "5-2. 외부 제작 Packet 내보내기 | 공감라인 AI",
  description: "외부 콘텐츠 제작용 Packet을 검증하고 내보냅니다.",
};

export default function ListingCreativeAdapterPage() {
  return <ListingCreativeAdapterExport />;
}
