import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminMfaAssuranceLevel,
  AdminMfaEnrollmentDto,
  AdminMfaFactorDto,
  AdminMfaStatusDto,
} from "@/shared/contracts/admin-mfa";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOTP_CODE_PATTERN = /^[0-9]{6}$/;
const TOTP_SECRET_PATTERN = /^[A-Z2-7]{16,128}$/;
const SVG_DATA_URL_PREFIX = "data:image/svg+xml;utf-8,";
const FRIENDLY_NAME = "GonggamLine Admin";

export type AdminMfaBoundaryErrorCode =
  | "MFA_CHALLENGE_FAILED"
  | "MFA_ENROLLMENT_CONFLICT"
  | "MFA_ENROLLMENT_FAILED"
  | "MFA_FACTOR_NOT_FOUND"
  | "MFA_STATUS_FAILED"
  | "MFA_UNENROLLMENT_FAILED"
  | "MFA_VERIFICATION_FAILED";

export class AdminMfaBoundaryError extends Error {
  constructor(
    readonly code: AdminMfaBoundaryErrorCode,
    readonly status: 400 | 404 | 409 | 500,
  ) {
    super("Multi-factor authentication is unavailable.");
    this.name = "AdminMfaBoundaryError";
  }
}

function requireAssuranceLevel(value: string | null): AdminMfaAssuranceLevel {
  if (value !== "aal1" && value !== "aal2") {
    throw new AdminMfaBoundaryError("MFA_STATUS_FAILED", 500);
  }
  return value;
}

function mapTotpFactors(value: unknown): ReadonlyArray<AdminMfaFactorDto> {
  if (!Array.isArray(value)) {
    throw new AdminMfaBoundaryError("MFA_STATUS_FAILED", 500);
  }

  return Object.freeze(
    value
      .filter(
        (factor): factor is Record<string, unknown> =>
          typeof factor === "object" &&
          factor !== null &&
          (factor as Record<string, unknown>).factor_type === "totp",
      )
      .map((factor) => {
        if (
          typeof factor.id !== "string" ||
          !UUID_PATTERN.test(factor.id) ||
          (factor.status !== "verified" && factor.status !== "unverified") ||
          typeof factor.created_at !== "string" ||
          (factor.friendly_name !== undefined &&
            typeof factor.friendly_name !== "string")
        ) {
          throw new AdminMfaBoundaryError("MFA_STATUS_FAILED", 500);
        }
        return Object.freeze({
          id: factor.id,
          friendlyName: factor.friendly_name ?? null,
          status: factor.status,
          createdAt: factor.created_at,
        });
      }),
  );
}

export async function readAdminMfaStatus(
  client: SupabaseClient,
): Promise<AdminMfaStatusDto> {
  const [factorsResult, assuranceResult] = await Promise.all([
    client.auth.mfa.listFactors(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorsResult.error || assuranceResult.error) {
    throw new AdminMfaBoundaryError("MFA_STATUS_FAILED", 500);
  }

  const factors = mapTotpFactors(factorsResult.data.all);
  const current = requireAssuranceLevel(assuranceResult.data.currentLevel);
  const next = requireAssuranceLevel(assuranceResult.data.nextLevel);
  const hasVerifiedFactor = factors.some((factor) => factor.status === "verified");

  return Object.freeze({
    assurance: Object.freeze({ current, next }),
    factors,
    enrollmentRequired: factors.length === 0,
    verificationRequired: hasVerifiedFactor && current !== "aal2",
    recovery: Object.freeze({
      automaticReset: false,
      mode: "owner-dashboard" as const,
    }),
  });
}

export async function beginAdminTotpEnrollment(
  client: SupabaseClient,
): Promise<AdminMfaEnrollmentDto> {
  const status = await readAdminMfaStatus(client);
  if (status.factors.length !== 0) {
    throw new AdminMfaBoundaryError("MFA_ENROLLMENT_CONFLICT", 409);
  }

  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: FRIENDLY_NAME,
  });
  if (
    error ||
    data.type !== "totp" ||
    !UUID_PATTERN.test(data.id) ||
    typeof data.totp.qr_code !== "string" ||
    !TOTP_SECRET_PATTERN.test(data.totp.secret)
  ) {
    throw new AdminMfaBoundaryError("MFA_ENROLLMENT_FAILED", 400);
  }

  const qrCode = data.totp.qr_code.trimStart();
  const qrCodeDataUrl = qrCode.startsWith(SVG_DATA_URL_PREFIX)
    ? qrCode
    : qrCode.startsWith("<svg")
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`
      : null;
  if (!qrCodeDataUrl) {
    throw new AdminMfaBoundaryError("MFA_ENROLLMENT_FAILED", 400);
  }

  return Object.freeze({
    factorId: data.id,
    qrCodeDataUrl,
    secret: data.totp.secret,
  });
}

export async function requireOwnedTotpFactor(
  client: SupabaseClient,
  factorId: string,
): Promise<AdminMfaFactorDto> {
  if (!UUID_PATTERN.test(factorId)) {
    throw new AdminMfaBoundaryError("MFA_FACTOR_NOT_FOUND", 404);
  }
  const status = await readAdminMfaStatus(client);
  const factor = status.factors.find((candidate) => candidate.id === factorId);
  if (!factor) {
    throw new AdminMfaBoundaryError("MFA_FACTOR_NOT_FOUND", 404);
  }
  return factor;
}

export async function challengeAdminTotpFactor(
  client: SupabaseClient,
  factorId: string,
): Promise<string> {
  await requireOwnedTotpFactor(client, factorId);
  const { data, error } = await client.auth.mfa.challenge({ factorId });
  if (error || !UUID_PATTERN.test(data.id)) {
    throw new AdminMfaBoundaryError("MFA_CHALLENGE_FAILED", 400);
  }
  return data.id;
}

export async function verifyAdminTotpChallenge(
  client: SupabaseClient,
  input: Readonly<{
    challengeId: string;
    code: string;
    factorId: string;
  }>,
): Promise<void> {
  if (
    !UUID_PATTERN.test(input.challengeId) ||
    !TOTP_CODE_PATTERN.test(input.code)
  ) {
    throw new AdminMfaBoundaryError("MFA_VERIFICATION_FAILED", 400);
  }
  await requireOwnedTotpFactor(client, input.factorId);
  const { error } = await client.auth.mfa.verify(input);
  if (error) {
    throw new AdminMfaBoundaryError("MFA_VERIFICATION_FAILED", 400);
  }
}

export async function unenrollAdminTotpFactor(
  client: SupabaseClient,
  factorId: string,
): Promise<void> {
  await requireOwnedTotpFactor(client, factorId);
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new AdminMfaBoundaryError("MFA_UNENROLLMENT_FAILED", 400);
  }
}
