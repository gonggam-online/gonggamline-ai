import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { AdminGuardContext } from "./admin-request-guard.server";

export const ADMIN_RECOVERY_COOKIE_NAME = "__Host-gonggamline-recovery";
export const ADMIN_RECOVERY_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: true,
  path: "/",
});

export class AdminRecoveryGrantError extends Error {
  readonly code = "RECOVERY_SESSION_REQUIRED";
  readonly status = 401;

  constructor() {
    super("Password recovery session required.");
    this.name = "AdminRecoveryGrantError";
  }
}

function secret(): string {
  const value = process.env.GONGGAMLINE_ADMIN_CSRF_SECRET;
  if (!value || value.trim() !== value) {
    throw new AdminRecoveryGrantError();
  }
  return value;
}

function signature(
  context: AdminGuardContext,
  expiry: number,
  nonce: string,
): Buffer {
  return createHmac("sha256", secret())
    .update(
      [
        "admin-password-recovery-v1",
        context.administratorUserId,
        context.sessionIdentity,
        String(expiry),
        nonce,
      ].join("\n"),
      "utf8",
    )
    .digest();
}

export function issueAdminRecoveryGrant(
  context: AdminGuardContext,
  options: Readonly<{ clock?: () => number }> = {},
): string {
  const expiry = Math.floor((options.clock ?? Date.now)() / 1_000) + 15 * 60;
  const nonce = randomBytes(24).toString("base64url");
  return `v1.${expiry}.${nonce}.${signature(context, expiry, nonce).toString("base64url")}`;
}

export function verifyAdminRecoveryGrant(
  request: Request,
  context: AdminGuardContext,
  options: Readonly<{ clock?: () => number }> = {},
): void {
  const token = readCookie(
    request.headers.get("cookie"),
    ADMIN_RECOVERY_COOKIE_NAME,
  );
  const parts = token?.split(".") ?? [];
  if (
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    !/^[1-9][0-9]*$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]{32}$/.test(parts[2]) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[3])
  ) {
    throw new AdminRecoveryGrantError();
  }
  const expiry = Number(parts[1]);
  const now = Math.floor((options.clock ?? Date.now)() / 1_000);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 15 * 60) {
    throw new AdminRecoveryGrantError();
  }
  const expected = signature(context, expiry, parts[2]);
  const supplied = Buffer.from(parts[3], "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AdminRecoveryGrantError();
  }
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return matches.length === 1 ? matches[0] : undefined;
}
