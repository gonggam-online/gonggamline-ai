import {
  AdminRequestGuardError,
  requireAdminRequest,
  requireExactAdminOrigin,
} from "@/lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { checkCoupangLogisticsPreflight } from "@/engines/listing/coupang-logistics-preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown): Response {
  if (error instanceof AdminRequestGuardError) return Response.json({ error: { code: error.code } }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  return Response.json({ error: { code: "COUPANG_LOGISTICS_PREFLIGHT_FAILED" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    requireExactAdminOrigin(request);
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    const global = adminRateLimiter.consume("coupang-logistics-preflight-global", "read");
    if (!rate.allowed || !global.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const data = await checkCoupangLogisticsPreflight();
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
