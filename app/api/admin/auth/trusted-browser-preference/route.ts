import { cookies } from "next/headers";

import {
  AdminRequestGuardError,
  requireAdminRequest,
  requireExactAdminOrigin,
  requireJsonContentType,
} from "@/lib/auth/admin-request-guard.server";
import { AdminCsrfError, verifyAdminCsrfToken } from "@/lib/auth/csrf.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "gonggamline_admin_trusted_browser_preference";

export async function POST(request: Request): Promise<Response> {
  try {
    requireExactAdminOrigin(request);
    requireJsonContentType(request);
    const context = await requireAdminRequest(request, "mutation");
    verifyAdminCsrfToken(request, "admin-session", context);
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).enabled !== "boolean") {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400 });
    }
    const enabled = (body as { enabled: boolean }).enabled;
    (await cookies()).set(COOKIE_NAME, enabled ? "1" : "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: enabled ? 60 * 60 * 24 * 30 : 0,
    });
    return Response.json({ enabled, securityBoundary: "MFA_REQUIRED_FOR_MUTATIONS" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AdminRequestGuardError || error instanceof AdminCsrfError) {
      return Response.json({ code: error.code }, { status: error.status });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
