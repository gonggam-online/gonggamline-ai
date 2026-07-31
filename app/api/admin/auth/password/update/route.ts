import { cookies } from "next/headers";

import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  ADMIN_RECOVERY_COOKIE_NAME,
  ADMIN_RECOVERY_COOKIE_OPTIONS,
  AdminRecoveryGrantError,
  verifyAdminRecoveryGrant,
} from "@/lib/auth/admin-password-recovery.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import {
  ADMIN_CSRF_COOKIE_NAME,
  AdminCsrfError,
  verifyAdminCsrfToken,
} from "@/lib/auth/csrf.server";
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
      Object.keys(body).length !== 2 ||
      typeof (body as Record<string, unknown>).password !== "string" ||
      typeof (body as Record<string, unknown>).confirmation !== "string"
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const { password, confirmation } = body as {
      password: string;
      confirmation: string;
    };
    if (
      password === "" ||
      password.length > 1_024 ||
      password !== confirmation
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }

    const client = await createSupabaseSsrServerClient();
    const context = await requireAdminRequest(request, "read", { client });
    verifyAdminRecoveryGrant(request, context);
    verifyAdminCsrfToken(request, "admin-password-recovery", context);
    const rate = adminRateLimiter.consume(
      context.administratorUserId,
      "mutation",
    );
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const { error } = await client.auth.updateUser({ password });
    if (error) {
      return Response.json({ code: "PASSWORD_UPDATE_FAILED" }, { status: 400 });
    }
    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) {
      return Response.json({ code: "SIGN_OUT_FAILED" }, { status: 500 });
    }
    (await cookies()).set(ADMIN_CSRF_COOKIE_NAME, "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    (await cookies()).set(ADMIN_RECOVERY_COOKIE_NAME, "", {
      ...ADMIN_RECOVERY_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return Response.json(
      { updated: true, reauthenticationRequired: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (
      error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError ||
      error instanceof AdminCsrfError ||
      error instanceof AdminRecoveryGrantError
    ) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
