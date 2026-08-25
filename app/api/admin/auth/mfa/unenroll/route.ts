import {
  AdminMfaBoundaryError,
  requireOwnedTotpFactor,
  unenrollAdminTotpFactor,
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
import { ADMIN_MFA_GRANT_COOKIE_NAME } from "@/lib/auth/admin-mfa-grant.server";

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const body: unknown = await request.json();
    const record =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : undefined;
    if (
      !record ||
      Object.keys(record).length !== 1 ||
      typeof record.factorId !== "string"
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }

    const client = await createSupabaseSsrServerClient();
    const context = await requireAdminRequest(request, "read", { client });
    verifyAdminCsrfToken(request, "admin-mfa", context);
    const factor = await requireOwnedTotpFactor(client, record.factorId);
    if (factor.status === "verified") {
      await requireAdminRequest(request, "mutation", { client });
    }
    const rate = adminRateLimiter.consume(
      context.administratorUserId,
      "mutation",
    );
    if (!rate.allowed) {
      return Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    }
    await unenrollAdminTotpFactor(client, factor.id);
    (await cookies()).set(ADMIN_MFA_GRANT_COOKIE_NAME, "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return Response.json({ unenrolled: true });
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
        { status: error.status },
      );
    }
    return Response.json(
      { code: "AUTHENTICATION_UNAVAILABLE" },
      { status: 500 },
    );
  }
}
