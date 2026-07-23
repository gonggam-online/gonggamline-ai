import { NextResponse } from "next/server";
import { collectorRegistry } from "../../../../lib/market/collectors/registry";
import { listCollectorState } from "../../../../services/market-orchestration.service";

export async function GET() {
  try {
    const state = await listCollectorState();
    return NextResponse.json({ success: true, registry: collectorRegistry, ...state });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Collector 조회 실패" }, { status: 500 });
  }
}
