import { NextResponse } from "next/server";

import { getLatestAutonomousMarketIntelligence } from "../../../../services/autonomous-market-discovery.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, intelligence: await getLatestAutonomousMarketIntelligence() });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 인텔리전스 조회 오류" }, { status: 500 });
  }
}
