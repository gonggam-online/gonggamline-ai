import { NextResponse } from "next/server";

import { NextRequest } from "next/server";
import { AdminRequestGuardError, requireAdminRequest, requireExactAdminOrigin, requireJsonContentType } from "../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../lib/auth/admin-rate-limit.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "../../../../lib/auth/csrf.server";
import { getLatestAutonomousMarketIntelligence, rebuildAutonomousMarketIntelligence } from "../../../../services/autonomous-market-discovery.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, intelligence: await getLatestAutonomousMarketIntelligence() });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 인텔리전스 조회 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "market-collection-run", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return NextResponse.json({ success: false, message: "요청 한도를 초과했습니다." }, { status: 429 });
    return NextResponse.json({ success: true, intelligence: await rebuildAutonomousMarketIntelligence() });
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) {
      return NextResponse.json({ success: false, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "시장 인텔리전스 재산출 오류" }, { status: 500 });
  }
}
