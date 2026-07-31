import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { AdminGuardContext } from "./admin-request-guard.server";

export const ADMIN_CSRF_COOKIE_NAME = "__Host-gonggamline-csrf";
export const ADMIN_CSRF_HEADER_NAME = "X-GonggamLine-CSRF";

export type AdminCsrfPurpose =
  | "admin-mfa"
  | "admin-session"
  | "admin-password-recovery"
  | "item-selection-create"
  | "item-selection-finalize"
  | "product-import"
  | "product-operator-patch"
  | "product-manual-competition"
  | "product-automatic-competition"
  | "product-competition-batch";

export type AdminCsrfToken = Readonly<{
  token: string;
  expiresAt: number;
}>;

export class AdminCsrfError extends Error {
  readonly code = "CSRF_DENIED";
  readonly status = 403;

  constructor() {
    super("Request verification failed.");
    this.name = "AdminCsrfError";
  }
}

function readCsrfSecret(): string {
  const secret = process.env.GONGGAMLINE_ADMIN_CSRF_SECRET;
  if (!secret || secret.trim() !== secret) {
    throw new AdminCsrfError();
  }
  return secret;
}

function mac(
  secret: string,
  purpose: AdminCsrfPurpose,
  context: AdminGuardContext,
  expiry: number,
  nonce: string,
): Buffer {
  const input = [
    "v1",
    purpose,
    context.administratorUserId,
    context.sessionIdentity,
    String(expiry),
    nonce,
  ].join("\n");
  return createHmac("sha256", secret).update(input, "utf8").digest();
}

export function issueAdminCsrfToken(
  purpose: AdminCsrfPurpose,
  context: AdminGuardContext,
  options: Readonly<{ clock?: () => number; ttlSeconds?: number }> = {},
): AdminCsrfToken {
  const ttlSeconds = options.ttlSeconds ?? 15 * 60;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 15 * 60) {
    throw new AdminCsrfError();
  }

  const expiresAt = Math.floor((options.clock ?? Date.now)() / 1_000) + ttlSeconds;
  const nonce = randomBytes(24).toString("base64url");
  const signature = mac(readCsrfSecret(), purpose, context, expiresAt, nonce);
  const token = `v1.${expiresAt}.${nonce}.${signature.toString("base64url")}`;
  return Object.freeze({ expiresAt, token });
}

export function verifyAdminCsrfToken(
  request: Request,
  purpose: AdminCsrfPurpose,
  context: AdminGuardContext,
  options: Readonly<{ clock?: () => number }> = {},
): void {
  const header = request.headers.get(ADMIN_CSRF_HEADER_NAME);
  const cookie = readCookie(request.headers.get("cookie"), ADMIN_CSRF_COOKIE_NAME);
  if (!header || !cookie || header !== cookie) {
    throw new AdminCsrfError();
  }

  const parts = header.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new AdminCsrfError();
  }

  const expiry = Number(parts[1]);
  const nonce = parts[2];
  if (
    !/^[1-9][0-9]*$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]{32}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[3]) ||
    !Number.isSafeInteger(expiry)
  ) {
    throw new AdminCsrfError();
  }

  const now = Math.floor((options.clock ?? Date.now)() / 1_000);
  if (expiry <= now || expiry > now + 15 * 60) {
    throw new AdminCsrfError();
  }

  let supplied: Buffer;
  try {
    supplied = Buffer.from(parts[3], "base64url");
  } catch {
    throw new AdminCsrfError();
  }
  const expected = mac(readCsrfSecret(), purpose, context, expiry, nonce);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AdminCsrfError();
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

export const ADMIN_CSRF_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: true,
  path: "/",
});
