import { cookies } from "next/headers";

import {
  AdminRequestGuardError,
  requireAdminRequest,
} from "@/lib/auth/admin-request-guard.server";
import { createSupabaseSsrServerClient } from "@/lib/auth/supabase-ssr.server";
import { buildAdminSessionStatus } from "@/lib/auth/admin-session-status.server";
import { hasValidAdminMfaGrant } from "@/lib/auth/admin-mfa-grant.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRUSTED_BROWSER_PREFERENCE = "gonggamline_admin_trusted_browser_preference";

export async function GET(request: Request): Promise<Response> {
  try {
    const client = await createSupabaseSsrServerClient();
    let refreshAttempted = false;
    const initial = await client.auth.getSession();
    if (initial.data.session?.expires_at !== undefined) {
      const expiresIn = initial.data.session.expires_at - Math.floor(Date.now() / 1_000);
      if (expiresIn < 120) {
        refreshAttempted = true;
        await client.auth.refreshSession();
      }
    }
    const context = await requireAdminRequest(request, "read", { client });
    const cookieStore = await cookies();
    const preference = cookieStore.get(TRUSTED_BROWSER_PREFERENCE)?.value === "1";
    const session = (await client.auth.getSession()).data.session;
    return Response.json(buildAdminSessionStatus(context, {
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1_000).toISOString()
        : null,
      refreshAttempted,
      trustedBrowserPreference: preference,
      mfaGrantValid: hasValidAdminMfaGrant(request, context),
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminRequestGuardError) {
      return Response.json({
        schemaVersion: "admin-session-status-v1",
        status: error.status === 401 ? "SIGNED_OUT" : "REAUTH_REQUIRED",
        authenticated: false,
        aal: null,
        ageSeconds: null,
        mutationReady: false,
        expiresAt: null,
        refreshAttempted: false,
        trustedBrowserPreference: false,
      }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ code: "AUTHENTICATION_UNAVAILABLE" }, { status: 500 });
  }
}
