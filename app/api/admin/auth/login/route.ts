import { readAdminMfaStatus } from "@/lib/auth/admin-mfa.server";
import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { ADMIN_CSRF_COOKIE_NAME } from "@/lib/auth/csrf.server";
import {
  createSupabaseSsrServerClient,
  SupabaseSsrConfigurationError,
} from "@/lib/auth/supabase-ssr.server";
import { cookies } from "next/headers";
import { ADMIN_MFA_GRANT_COOKIE_NAME } from "@/lib/auth/admin-mfa-grant.server";

function failure(error: unknown): Response {
  if (
    error instanceof AdminRequestGuardError ||
    error instanceof AdminUnsupportedMediaTypeError
  ) {
    return Response.json({ code: error.code }, { status: error.status });
  }
  return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const clientKey =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";
    const rate = adminRateLimiter.consume(clientKey, "mutation");
    if (!rate.allowed) {
      return Response.json(
        { code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      Object.keys(body).length !== 2 ||
      typeof (body as Record<string, unknown>).email !== "string" ||
      typeof (body as Record<string, unknown>).password !== "string" ||
      (body as Record<string, string>).email.trim() === "" ||
      (body as Record<string, string>).password === ""
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }

    const { email, password } = body as { email: string; password: string };
    const client = await createSupabaseSsrServerClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return Response.json({ code: "AUTHENTICATION_FAILED" }, { status: 400 });
    }
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_MFA_GRANT_COOKIE_NAME, "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    cookieStore.set(ADMIN_CSRF_COOKIE_NAME, "", {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return Response.json({
      authenticated: true,
      mfa: await readAdminMfaStatus(client),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (error instanceof SupabaseSsrConfigurationError) {
      return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
    }
    return failure(error);
  }
}
