import type { Metadata } from "next";

import { ItemSelectionAdmin } from "@/components/item-selection-admin/item-selection-admin";

export const metadata: Metadata = {
  title: "Item Selection Admin",
  description: "Run and review bounded supplier item evaluations.",
};

export default function ItemSelectionAdminPage() {
  return <ItemSelectionAdmin />;
}
