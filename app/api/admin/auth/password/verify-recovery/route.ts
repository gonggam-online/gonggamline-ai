import { cookies } from "next/headers";

import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { isAllowlistedAdminUser } from "@/lib/auth/admin-allowlist.server";
import {
  ADMIN_RECOVERY_COOKIE_NAME,
  ADMIN_RECOVERY_COOKIE_OPTIONS,
  issueAdminRecoveryGrant,
} from "@/lib/auth/admin-password-recovery.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const rate = adminRateLimiter.consume(clientKey(request), "mutation");
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      typeof (body as Record<string, unknown>).email !== "string" ||
      typeof (body as Record<string, unknown>).token !== "string"
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const { email, token } = body as { email: string; token: string };
    const normalizedEmail = email.trim();
    if (
      normalizedEmail === "" ||
      normalizedEmail.length > 254 ||
      !normalizedEmail.includes("@") ||
      !/^[0-9]{6}$/.test(token)
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }

    const client = await createSupabaseSsrServerClient();
    const { error } = await client.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "recovery",
    });
    if (error) {
      return Response.json({ code: "AUTHENTICATION_FAILED" }, { status: 400 });
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user || !isAllowlistedAdminUser(user.id)) {
        await client.auth.signOut({ scope: "global" });
        return Response.json({ code: "AUTHORIZATION_DENIED" }, { status: 403 });
      }

      const context = await requireAdminRequest(request, "read", { client });
      (await cookies()).set(
        ADMIN_RECOVERY_COOKIE_NAME,
        issueAdminRecoveryGrant(context),
        ADMIN_RECOVERY_COOKIE_OPTIONS,
      );
      return Response.json(
        { verified: true, redirect: "/admin/password-recovery" },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      await client.auth.signOut({ scope: "global" });
      throw error;
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (
      error instanceof AdminRequestGuardError ||
      error instanceof AdminUnsupportedMediaTypeError
    ) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
