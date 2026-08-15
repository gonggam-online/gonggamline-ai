import type { Metadata } from "next";

import { ListingCreativeAdapterReprepare } from "@/components/listing/listing-creative-adapter-reprepare";

export const metadata: Metadata = {
  title: "Listing Creative Adapter Re-prepare",
  description: "Create a new owner-controlled external adapter packet revision from current WING evidence.",
};

export default function ListingCreativeAdapterRepreparePage() {
  return <ListingCreativeAdapterReprepare />;
}
