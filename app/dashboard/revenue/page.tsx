import type { Metadata } from "next";
import { RevenueDashboard } from "@/components/revenue-dashboard/revenue-dashboard";
import { parseDashboardLocation } from "@/lib/revenue/dashboard-ui-state";

export const metadata: Metadata = {
  title: "Revenue Dashboard",
  description: "AI Revenue Ranking Overview",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RevenueDashboardPage({ searchParams }: PageProps) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
    else if (value?.[0]) params.set(key, value[0]);
  }
  return <RevenueDashboard initialLocation={parseDashboardLocation(params)} />;
}
