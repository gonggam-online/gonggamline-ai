import type { Metadata } from "next";

import { ListingCreativeAdapterExport } from "@/components/listing/listing-creative-adapter-export";

export const metadata: Metadata = {
  title: "Listing Creative Adapter Export",
  description: "Validate and export an owner-controlled external listing adapter packet.",
};

export default function ListingCreativeAdapterPage() {
  return <ListingCreativeAdapterExport />;
}
