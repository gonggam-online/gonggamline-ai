export const ADMIN_SESSION_STATUS_VERSION = "admin-session-status-v1" as const;

export type AdminSessionStatus =
  | "SIGNED_OUT"
  | "MFA_REQUIRED"
  | "MFA_VERIFIED"
  | "REAUTH_REQUIRED";

export type AdminSessionStatusDto = Readonly<{
  schemaVersion: typeof ADMIN_SESSION_STATUS_VERSION;
  status: AdminSessionStatus;
  authenticated: boolean;
  aal: "aal1" | "aal2" | null;
  ageSeconds: number | null;
  mutationReady: boolean;
  expiresAt: string | null;
  refreshAttempted: boolean;
  trustedBrowserPreference: boolean;
}>;
