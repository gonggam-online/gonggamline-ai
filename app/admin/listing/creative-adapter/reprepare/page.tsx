import type { Metadata } from "next";

import { ListingCreativeAdapterReprepare } from "@/components/listing/listing-creative-adapter-reprepare";

export const metadata: Metadata = {
  title: "5-3. 외부 제작 Packet 재준비 | 공감라인 AI",
  description: "Create a new owner-controlled external adapter packet revision from current WING evidence.",
};

export default function ListingCreativeAdapterRepreparePage() {
  return <ListingCreativeAdapterReprepare />;
}
