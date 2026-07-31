import {
  AdminMfaBoundaryError,
  verifyAdminTotpChallenge,
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
import { cookies } from "next/headers";
import { ADMIN_CSRF_COOKIE_NAME } from "@/lib/auth/csrf.server";

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const client = await createSupabaseSsrServerClient();
    const context = await requireAdminRequest(request, "read", { client });
    verifyAdminCsrfToken(request, "admin-mfa", context);
    const rate = adminRateLimiter.consume(context.administratorUserId, "mutation");
    if (!rate.allowed) {
      return Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    }
    const body: unknown = await request.json();
    const record =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : undefined;
    if (
      !record ||
      Object.keys(record).length !== 3 ||
      typeof record.factorId !== "string" ||
      typeof record.challengeId !== "string" ||
      typeof record.code !== "string" ||
      record.factorId.trim() === "" ||
      record.challengeId.trim() === "" ||
      !/^[0-9]{6}$/.test(record.code)
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    await verifyAdminTotpChallenge(client, {
      factorId: record.factorId,
      challengeId: record.challengeId,
      code: record.code,
    });
    const { data, error: aalError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError || data.currentLevel !== "aal2") {
      return Response.json({ code: "AUTHORIZATION_DENIED" }, { status: 403 });
    }
    await requireAdminRequest(request, "mutation", { client });
    (await cookies()).set(ADMIN_CSRF_COOKIE_NAME, "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return Response.json({ assurance: "aal2" });
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
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
