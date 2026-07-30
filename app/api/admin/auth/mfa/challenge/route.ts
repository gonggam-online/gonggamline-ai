import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import {
  AdminCsrfError,
  verifyAdminCsrfToken,
} from "@/lib/auth/csrf.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const client = await createSupabaseSsrServerClient();
    const context = await requireAdminRequest(request, "read", { client });
    verifyAdminCsrfToken(request, "admin-session", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) {
      return Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    }
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      Object.keys(body).length !== 1 ||
      typeof (body as Record<string, unknown>).factorId !== "string" ||
      (body as { factorId: string }).factorId.trim() === ""
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const { data, error } = await client.auth.mfa.challenge({
      factorId: (body as { factorId: string }).factorId,
    });
    if (error || !data.id) {
      return Response.json({ code: "MFA_CHALLENGE_FAILED" }, { status: 400 });
    }
    return Response.json({ challengeId: data.id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (
      error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError ||
      error instanceof AdminCsrfError
    ) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
