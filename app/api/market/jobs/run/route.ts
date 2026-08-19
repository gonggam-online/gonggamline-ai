import { NextRequest, NextResponse } from "next/server";
import { AdminRequestGuardError, requireAdminRequest, requireExactAdminOrigin, requireJsonContentType } from "../../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../../lib/auth/admin-rate-limit.server";
import { verifyAdminCsrfToken, AdminCsrfError } from "../../../../../lib/auth/csrf.server";
import { runDueCollectionJobs } from "../../../../../services/market-orchestration.service";

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminRequest(request, "mutation");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "market-collection-run", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return NextResponse.json({ success: false, message: "요청 한도를 초과했습니다." }, { status: 429 });
    const body = await request.json().catch(() => ({}));
    const result = await runDueCollectionJobs(Math.min(100, Math.max(1, Number(body.limit || 20))));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) {
      return NextResponse.json({ error: { code: error.code } }, { status: error.status });
    }
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "스케줄 실행 실패" }, { status: 500 });
  }
}
