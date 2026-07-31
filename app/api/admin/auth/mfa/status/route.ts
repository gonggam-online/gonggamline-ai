import {
  AdminMfaBoundaryError,
  readAdminMfaStatus,
} from "@/lib/auth/admin-mfa.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  requireAdminRequest,
} from "@/lib/auth/admin-request-guard.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";

export async function GET(request: Request): Promise<Response> {
  try {
    const client = await createSupabaseSsrServerClient();
    const context = await requireAdminRequest(request, "read", { client });
    const rate = adminRateLimiter.consume(context.administratorUserId, "read");
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    return Response.json(await readAdminMfaStatus(client), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (
      error instanceof AdminRequestGuardError ||
      error instanceof AdminMfaBoundaryError
    ) {
      return Response.json(
        { code: error.code },
        {
          status: error.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    return Response.json(
      { code: "AUTHENTICATION_UNAVAILABLE" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
