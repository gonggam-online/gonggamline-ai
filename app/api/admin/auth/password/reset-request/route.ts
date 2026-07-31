import { adminRateLimiter } from "@/lib/auth/admin-rate-limit.server";
import {
  AdminRequestGuardError,
  AdminUnsupportedMediaTypeError,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import {
  createSupabaseSsrServerClient,
  SupabaseSsrConfigurationError,
} from "@/lib/auth/supabase-ssr.server";

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
      Object.keys(body).length !== 1 ||
      typeof (body as Record<string, unknown>).email !== "string"
    ) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const email = (body as { email: string }).email.trim();
    if (email === "" || email.length > 254 || !email.includes("@")) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }

    const origin = process.env.GONGGAMLINE_ADMIN_ALLOWED_ORIGIN;
    if (!origin) {
      throw new SupabaseSsrConfigurationError();
    }
    const client = await createSupabaseSsrServerClient();
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/api/admin/auth/callback?purpose=password-recovery`,
    });

    return Response.json(
      { accepted: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
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
