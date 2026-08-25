import { createHmac, timingSafeEqual } from "node:crypto";

import type { AdminGuardContext } from "./admin-request-guard.server";

export const ADMIN_MFA_GRANT_COOKIE_NAME = "__Host-gonggamline-mfa-grant";
export const ADMIN_MFA_GRANT_TTL_SECONDS = 12 * 60 * 60;

export const ADMIN_MFA_GRANT_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: true,
  path: "/",
  maxAge: ADMIN_MFA_GRANT_TTL_SECONDS,
});

function readSecret(): string {
  const secret = process.env.GONGGAMLINE_ADMIN_CSRF_SECRET;
  if (!secret || secret.trim() !== secret) {
    throw new Error("MFA grant secret unavailable");
  }
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return decoded === "" || decoded.includes(".") ? null : decoded;
  } catch {
    return null;
  }
}

function sign(version: string, expiry: number, userId: string, sessionId: string): string {
  return createHmac("sha256", readSecret())
    .update(["admin-mfa-grant", version, String(expiry), userId, sessionId].join("\n"), "utf8")
    .digest("base64url");
}

export function issueAdminMfaGrant(
  context: Pick<AdminGuardContext, "administratorUserId" | "sessionIdentity">,
  now = Date.now,
): string {
  const expiry = Math.floor(now() / 1_000) + ADMIN_MFA_GRANT_TTL_SECONDS;
  const version = "v1";
  const userId = encode(context.administratorUserId);
  const sessionId = encode(context.sessionIdentity);
  return [version, String(expiry), userId, sessionId, sign(version, expiry, context.administratorUserId, context.sessionIdentity)].join(".");
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const values = header.split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${ADMIN_MFA_GRANT_COOKIE_NAME}=`))
    .map((part) => part.slice(ADMIN_MFA_GRANT_COOKIE_NAME.length + 1));
  return values.length === 1 ? values[0] : null;
}

export function hasValidAdminMfaGrant(
  request: Request,
  context: Pick<AdminGuardContext, "administratorUserId" | "sessionIdentity">,
  now = Date.now,
): boolean {
  const token = readCookie(request);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return false;
  const expiry = Number(parts[1]);
  const userId = decode(parts[2]);
  const sessionId = decode(parts[3]);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now() / 1_000) || !userId || !sessionId) return false;
  if (userId !== context.administratorUserId || sessionId !== context.sessionIdentity) return false;
  try {
    const supplied = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(sign(parts[0], expiry, userId, sessionId), "base64url");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}
