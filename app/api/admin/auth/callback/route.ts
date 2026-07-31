import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import { isAllowlistedAdminUser } from "@/lib/auth/admin-allowlist.server";
import {
  ADMIN_RECOVERY_COOKIE_NAME,
  ADMIN_RECOVERY_COOKIE_OPTIONS,
  issueAdminRecoveryGrant,
} from "@/lib/auth/admin-password-recovery.server";
import { requireAdminRequest } from "@/lib/auth/admin-request-guard.server";
import { ADMIN_CSRF_COOKIE_NAME } from "@/lib/auth/csrf.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const configuredOrigin = process.env.GONGGAMLINE_ADMIN_ALLOWED_ORIGIN;
    if (!configuredOrigin || url.origin !== configuredOrigin) {
      return Response.json({ code: "ORIGIN_DENIED" }, { status: 403 });
    }
    const codes = url.searchParams.getAll("code");
    const purposes = url.searchParams.getAll("purpose");
    const purpose =
      purposes.length === 0
        ? "login"
        : purposes.length === 1 && purposes[0] === "password-recovery"
          ? "password-recovery"
          : null;
    if (
      codes.length !== 1 ||
      codes[0].trim() === "" ||
      purpose === null ||
      [...url.searchParams.keys()].some(
        (key) => key !== "code" && key !== "purpose",
      )
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const clientKey =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";
    const rate = adminRateLimiter.consume(clientKey, "read");
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }
    const client = await createSupabaseSsrServerClient();
    const { error } = await client.auth.exchangeCodeForSession(codes[0]);
    if (error) {
      return Response.json({ code: "AUTHENTICATION_FAILED" }, { status: 400 });
    }
    if (purpose === "password-recovery") {
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
    } else {
      (await cookies()).set(ADMIN_RECOVERY_COOKIE_NAME, "", {
        ...ADMIN_RECOVERY_COOKIE_OPTIONS,
        maxAge: 0,
      });
    }
    (await cookies()).set(ADMIN_CSRF_COOKIE_NAME, "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return NextResponse.redirect(
      new URL(
        purpose === "password-recovery"
          ? "/admin/password-recovery"
          : "/admin/login",
        configuredOrigin,
      ),
      303,
    );
  } catch {
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
