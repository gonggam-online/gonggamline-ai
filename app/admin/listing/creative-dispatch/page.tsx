import type { Metadata } from "next";

import { ListingCreativeOperator } from "@/components/listing/listing-creative-operator";

export const metadata: Metadata = {
  title: "Listing Creative Operator",
  description: "Prepare, generate, and privately review bounded listing creative candidates.",
};

export default function ListingCreativeDispatchPage() {
  return <ListingCreativeOperator />;
}
