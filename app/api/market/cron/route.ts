import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { runDueCollectionJobs } from "../../../../services/market-orchestration.service";

function authorized(request: NextRequest): boolean {
  const configured = process.env.MARKET_CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!configured || !supplied) return false;
  const left = Buffer.from(configured, "utf8");
  const right = Buffer.from(supplied, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const result = await runDueCollectionJobs(20);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 수집 실행 실패" }, { status: 500 });
  }
}
