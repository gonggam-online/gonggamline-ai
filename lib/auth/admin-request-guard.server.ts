import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isAllowlistedAdminUser } from "./admin-allowlist.server";
import { hasValidAdminMfaGrant } from "./admin-mfa-grant.server";
import { createSupabaseSsrServerClient } from "./supabase-ssr.server";

export type AdminAssuranceLevel = "aal1" | "aal2";
export type AdminRouteAssurance = "read" | "mutation";

export type AdminGuardContext = Readonly<{
  administratorUserId: string;
  aal: AdminAssuranceLevel;
  jwtIssuedAt: number;
  sessionIdentity: string;
  route: string;
  correlationId: string;
}>;

const issuedGuardContexts = new WeakSet<object>();

export class AdminRequestGuardError extends Error {
  readonly code: "AUTHENTICATION_REQUIRED" | "AUTHORIZATION_DENIED";
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? "Authentication required." : "Authorization denied.");
    this.name = "AdminRequestGuardError";
    this.status = status;
    this.code = status === 401 ? "AUTHENTICATION_REQUIRED" : "AUTHORIZATION_DENIED";
  }
}

export class AdminUnsupportedMediaTypeError extends Error {
  readonly code = "UNSUPPORTED_MEDIA_TYPE";
  readonly status = 415;

  constructor() {
    super("Unsupported media type.");
    this.name = "AdminUnsupportedMediaTypeError";
  }
}

type VerifiedJwtClaims = Readonly<{
  aal: AdminAssuranceLevel;
  iat: number;
  sessionIdentity: string;
}>;

function readVerifiedJwtClaims(accessToken: string): VerifiedJwtClaims {
  const parts = accessToken.split(".");
  if (parts.length !== 3) {
    throw new AdminRequestGuardError(401);
  }

  try {
    const claims: unknown = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (typeof claims !== "object" || claims === null) {
      throw new AdminRequestGuardError(401);
    }

    const record = claims as Record<string, unknown>;
    const aal = record.aal;
    const iat = record.iat;
    const sessionIdentity = record.session_id;
    if (
      (aal !== "aal1" && aal !== "aal2") ||
      !Number.isInteger(iat) ||
      typeof sessionIdentity !== "string" ||
      sessionIdentity === ""
    ) {
      throw new AdminRequestGuardError(401);
    }

    return Object.freeze({
      aal,
      iat: iat as number,
      sessionIdentity,
    });
  } catch (error) {
    if (error instanceof AdminRequestGuardError) {
      throw error;
    }
    throw new AdminRequestGuardError(401);
  }
}

export async function requireAdminRequest(
  request: Request,
  assurance: AdminRouteAssurance,
  options: Readonly<{
    client?: SupabaseClient;
    clock?: () => number;
    correlationId?: string;
  }> = {},
): Promise<AdminGuardContext> {
  const client = options.client ?? (await createSupabaseSsrServerClient());
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new AdminRequestGuardError(401);
  }
  if (!isAllowlistedAdminUser(user.id)) {
    throw new AdminRequestGuardError(403);
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new AdminRequestGuardError(401);
  }

  const claims = readVerifiedJwtClaims(session.access_token);
  const nowSeconds = Math.floor((options.clock ?? Date.now)() / 1_000);
  const authenticationAge = nowSeconds - claims.iat;
  const freshAal2 = claims.aal === "aal2" && authenticationAge <= 60;
  const sessionMfaGrant = assurance === "mutation" && claims.aal === "aal2"
    ? hasValidAdminMfaGrant(request, {
      administratorUserId: user.id.toLowerCase(),
      sessionIdentity: claims.sessionIdentity,
    }, options.clock)
    : false;
  if (
    authenticationAge < 0 ||
    (assurance === "mutation" && !freshAal2 && !sessionMfaGrant)
  ) {
    throw new AdminRequestGuardError(403);
  }

  const context: AdminGuardContext = Object.freeze({
    administratorUserId: user.id.toLowerCase(),
    aal: claims.aal,
    jwtIssuedAt: claims.iat,
    sessionIdentity: claims.sessionIdentity,
    route: new URL(request.url).pathname,
    correlationId: options.correlationId ?? crypto.randomUUID(),
  });
  issuedGuardContexts.add(context);
  return context;
}

export function isSameRequestAdminGuardContext(
  value: AdminGuardContext,
): boolean {
  return issuedGuardContexts.has(value);
}

export function requireExactAdminOrigin(
  request: Request,
  configuredOrigin: string | undefined = process.env.GONGGAMLINE_ADMIN_ALLOWED_ORIGIN,
): void {
  const allowedOrigin = parseAllowedOrigin(configuredOrigin);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    origin === null ||
    origin === "null" ||
    origin.includes(",") ||
    fetchSite !== "same-origin"
  ) {
    throw new AdminRequestGuardError(403);
  }

  try {
    if (new URL(origin).origin !== origin || origin !== allowedOrigin) {
      throw new AdminRequestGuardError(403);
    }
  } catch (error) {
    if (error instanceof AdminRequestGuardError) {
      throw error;
    }
    throw new AdminRequestGuardError(403);
  }
}

function parseAllowedOrigin(value: string | undefined): string {
  if (!value || value.trim() !== value) {
    throw new AdminRequestGuardError(403);
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.origin !== value ||
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    ) {
      throw new AdminRequestGuardError(403);
    }
    return parsed.origin;
  } catch {
    throw new AdminRequestGuardError(403);
  }
}

export function requireJsonContentType(request: Request): void {
  if (request.headers.get("content-type")?.toLowerCase() !== "application/json") {
    throw new AdminUnsupportedMediaTypeError();
  }
}
