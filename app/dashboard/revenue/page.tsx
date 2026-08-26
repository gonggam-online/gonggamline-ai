import type { Metadata } from "next";
import { RevenueDashboard } from "@/components/revenue-dashboard/revenue-dashboard";
import { parseDashboardLocation } from "@/lib/revenue/dashboard-ui-state";

export const metadata: Metadata = {
  title: "7-1. 상품 성과 Revenue Dashboard | 공감라인 AI",
  description: "상품별 수익성, Revenue Score, 순위와 분석 상태를 조회합니다.",
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
