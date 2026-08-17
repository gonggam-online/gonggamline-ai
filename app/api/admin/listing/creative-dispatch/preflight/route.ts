import {
  AdminRequestGuardError,
  requireAdminRequest,
} from "@/lib/auth/admin-request-guard.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { probeProductionListingCreativeProvider } from "@/engines/listing/provider-preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAdminRequest(request, "read");
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) return Response.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
    const result = await probeProductionListingCreativeProvider(process.env);
    return Response.json({
      data: {
        status: result.status,
        providerId: result.providerId,
        modelVersion: result.modelVersion,
        paidCallAttempted: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminRequestGuardError) {
      return Response.json({ error: { code: error.code } }, { status: error.status });
    }
    return Response.json({ error: { code: "PROVIDER_PREFLIGHT_UNAVAILABLE" } }, { status: 503 });
  }
}
