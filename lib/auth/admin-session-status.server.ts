import type { AdminGuardContext } from "./admin-request-guard.server";
import type { AdminSessionStatus, AdminSessionStatusDto } from "@/shared/contracts/admin-session-status";
import { ADMIN_SESSION_STATUS_VERSION } from "@/shared/contracts/admin-session-status";

export function buildAdminSessionStatus(
  context: AdminGuardContext | null,
  input: Readonly<{
    expiresAt: string | null;
    refreshAttempted: boolean;
    trustedBrowserPreference: boolean;
    mfaGrantValid?: boolean;
  }>,
): AdminSessionStatusDto {
  const ageSeconds = context === null
    ? null
    : Math.max(0, Math.floor(Date.now() / 1_000) - context.jwtIssuedAt);
  let status: AdminSessionStatus = "SIGNED_OUT";
  if (context !== null) {
    status = context.aal === "aal2"
      ? (input.mfaGrantValid || (ageSeconds !== null && ageSeconds <= 60) ? "MFA_VERIFIED" : "REAUTH_REQUIRED")
      : "MFA_REQUIRED";
  }
  return Object.freeze({
    schemaVersion: ADMIN_SESSION_STATUS_VERSION,
    status,
    authenticated: context !== null,
    aal: context?.aal ?? null,
    ageSeconds,
    mutationReady: status === "MFA_VERIFIED",
    expiresAt: input.expiresAt,
    refreshAttempted: input.refreshAttempted,
    trustedBrowserPreference: input.trustedBrowserPreference,
  });
}
