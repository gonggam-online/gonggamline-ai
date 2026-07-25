import type { Metadata } from "next";
import { RevenueDashboard } from "@/components/revenue-dashboard/revenue-dashboard";

export const metadata: Metadata = {
  title: "Revenue Dashboard",
  description: "AI Revenue Ranking Overview",
};

export default function RevenueDashboardPage() {
  return <RevenueDashboard />;
}
