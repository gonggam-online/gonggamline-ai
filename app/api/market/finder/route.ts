import { NextResponse } from "next/server";

import { getItemDiscoveryFinder } from "../../../../services/item-discovery-finder.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, finder: await getItemDiscoveryFinder() });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "아이템 발굴 데이터 조회 오류" }, { status: 500 });
  }
}
