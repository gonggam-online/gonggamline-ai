import { NextRequest, NextResponse } from "next/server";
import { AdminRequestGuardError, requireAdminRequest, requireExactAdminOrigin, requireJsonContentType } from "../../../../lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "../../../../lib/auth/admin-rate-limit.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "../../../../lib/auth/csrf.server";
import { importTenbiRows, parseTenbiCsv } from "../../../../lib/market/tenbi-import";
import { persistGuardedExternalMarketImport } from "../../../../services/external-market-import.repository";
export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "market-external-import", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return NextResponse.json({ success: false, message: "요청 한도를 초과했습니다." }, { status: 429 });
    const body = await request.json() as { csv?: string; rows?: Record<string, unknown>[] };
    const result = importTenbiRows(body.rows ?? parseTenbiCsv(body.csv ?? ""));
    if (result.rows.length === 0) return NextResponse.json({ success: false, message: "유효한 Tenbi 행이 없습니다.", rejected: result.rejected }, { status: 400 });
    const persisted = await persistGuardedExternalMarketImport({ source: "tenbi", sourceDigest: result.sourceDigest, packets: result.packets, observations: result.rows, rejected: result.rejected }, context);
    return NextResponse.json({ success: true, sourceDigest: result.sourceDigest, ...persisted, rejected: result.rejected });
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) return NextResponse.json({ error: { code: error.code } }, { status: error.status });
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Tenbi import 오류" }, { status: 500 });
  }
}
