import { NextRequest, NextResponse } from "next/server";

import { adminRateLimiter } from "../../../../lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "../../../../lib/auth/admin-request-guard.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "../../../../lib/auth/csrf.server";
import { parseTenbiCsv, importTenbiRows } from "../../../../lib/market/tenbi-import";
import { importTikTokRows, parseTikTokCsv } from "../../../../lib/market/tiktok-import";
import { persistExternalMarketImport } from "../../../../services/external-market-import.service";

type ImportBody = Readonly<{
  source?: "tenbi" | "tiktok";
  text?: string;
  rows?: Record<string, unknown>[];
}>;

export async function POST(request: NextRequest) {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "market-external-import", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) return NextResponse.json({ success: false, message: "요청 한도를 초과했습니다." }, { status: 429 });

    const body = await request.json() as ImportBody;
    if (body.source !== "tenbi" && body.source !== "tiktok") return NextResponse.json({ success: false, message: "지원하지 않는 데이터 출처입니다." }, { status: 400 });
    if ((body.text?.length ?? 0) > 2_000_000 || (body.rows?.length ?? 0) > 5_000) return NextResponse.json({ success: false, message: "한 번에 최대 5,000행 또는 2MB까지 가져올 수 있습니다." }, { status: 413 });

    const rows = body.rows ?? (body.source === "tenbi" ? parseTenbiCsv(body.text ?? "") : parseTikTokCsv(body.text ?? ""));
    if (body.source === "tenbi") {
      const result = importTenbiRows(rows);
      if (!result.rows.length) return NextResponse.json({ success: false, message: "유효한 Tenbi 행이 없습니다.", rejected: result.rejected }, { status: 400 });
      const persisted = await persistExternalMarketImport({ source: "tenbi", sourceDigest: result.sourceDigest, packets: result.packets, observations: result.rows, rejected: result.rejected });
      return NextResponse.json({ success: true, source: body.source, sourceDigest: result.sourceDigest, ...persisted, rejected: result.rejected });
    }

    const result = importTikTokRows(rows);
    if (!result.packets.length) return NextResponse.json({ success: false, message: "유효한 TikTok 행이 없습니다.", rejected: result.rejected }, { status: 400 });
    const persisted = await persistExternalMarketImport({ source: "tiktok", sourceDigest: result.sourceDigest, packets: result.packets, rejected: result.rejected });
    return NextResponse.json({ success: true, source: body.source, sourceDigest: result.sourceDigest, ...persisted, rejected: result.rejected });
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) {
      return NextResponse.json({ error: { code: error.code } }, { status: error.status });
    }
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "외부 시장신호 가져오기 오류" }, { status: 500 });
  }
}
