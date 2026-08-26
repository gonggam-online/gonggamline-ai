import { NextResponse } from "next/server";
import { getUnifiedItemDiscoveryDashboard } from "../../../../services/unified-item-discovery.service";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, dashboard: await getUnifiedItemDiscoveryDashboard() }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "아이템 발굴 대시보드 조회 오류" }, { status: 500 }); }
}
