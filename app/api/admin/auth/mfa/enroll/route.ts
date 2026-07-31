import {
  AdminMfaBoundaryError,
  beginAdminTotpEnrollment,
} from "@/lib/auth/admin-mfa.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 0
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }

    const client = await createSupabaseSsrServerClient();
    const context = await requireAdminRequest(request, "read", { client });
    verifyAdminCsrfToken(request, "admin-mfa", context);
    const rate = adminRateLimiter.consume(
      context.administratorUserId,
      "mutation",
    );
    if (!rate.allowed) {
      return Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    }
    return Response.json(await beginAdminTotpEnrollment(client), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (
      error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError ||
      error instanceof AdminCsrfError ||
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
