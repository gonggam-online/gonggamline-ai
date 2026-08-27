import { NextResponse } from "next/server";

import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";
import { discoverPublicSupplierCandidates } from "@/lib/sourcing/public-supplier-discovery.server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function parseKeyword(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "keyword")) return null;
  if (typeof body.keyword !== "string") return null;
  const keyword = body.keyword.normalize("NFC").trim();
  return keyword.length >= 2 && keyword.length <= 100 && !/[\u0000-\u001f\u007f]/u.test(keyword)
    ? keyword
    : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    verifyAdminCsrfToken(request, "supplier-public-discovery", context);
    const userRate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    const globalRate = adminRateLimiter.consume("supplier-public-discovery-global", "mutation");
    if (!userRate.allowed || !globalRate.allowed) {
      return NextResponse.json({ success: false, code: "RATE_LIMITED" }, { status: 429 });
    }
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 400 });
    }
    const keyword = parseKeyword(json);
    if (!keyword) return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 400 });
    const result = await discoverPublicSupplierCandidates(keyword);
    return NextResponse.json({ success: true, data: result }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof AdminRequestGuardError ||
        error instanceof AdminUnsupportedMediaTypeError ||
        error instanceof AdminCsrfError) {
      return NextResponse.json({ success: false, code: error.code }, { status: error.status });
    }
    const code = error instanceof Error && /^(?:DATAFORSEO|SUPPLIER_DISCOVERY)_/.test(error.message)
      ? error.message
      : "SUPPLIER_DISCOVERY_FAILED";
    const status = code === "DATAFORSEO_COST_CEILING_EXCEEDED" ? 409
      : code === "DATAFORSEO_CREDENTIALS_MISSING" || code === "DATAFORSEO_COST_CEILING_MISSING" ? 503
        : 502;
    return NextResponse.json({ success: false, code }, { status });
  }
}
