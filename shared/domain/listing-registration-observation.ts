import { createHash } from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/;

export const LISTING_REGISTRATION_OBSERVATION_VERSION =
  "gonggamline-listing-registration-observation-v1" as const;

export type ListingRegistrationObservationInput = Readonly<{
  packetId: string;
  revisionId: string;
  packetDigest: string;
  contentDigest: string;
  selectedVariantId: string;
  marketplace: "COUPANG_WING";
  sellerProductId: string;
  registeredAt: string;
}>;

export type ListingRegistrationObservation = Readonly<{
  schemaVersion: typeof LISTING_REGISTRATION_OBSERVATION_VERSION;
  observationId: string;
  packetId: string;
  revisionId: string;
  packetDigest: string;
  contentDigest: string;
  selectedVariantId: string;
  marketplace: "COUPANG_WING";
  sellerProductId: string;
  registeredAt: string;
  learningStatus: "AWAITING_TRAFFIC";
  winnerDeclared: false;
}>;

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

export function buildListingRegistrationObservation(
  input: ListingRegistrationObservationInput,
): ListingRegistrationObservation {
  const packetId = requireText(input.packetId, "packetId");
  const revisionId = requireText(input.revisionId, "revisionId");
  const sellerProductId = requireText(input.sellerProductId, "sellerProductId");
  if (!SHA256.test(input.packetDigest) || !SHA256.test(input.contentDigest)) {
    throw new Error("packetDigest and contentDigest must be SHA-256 digests");
  }
  if (!Number.isFinite(Date.parse(input.registeredAt))) throw new Error("registeredAt must be ISO date");
  const core = {
    schemaVersion: LISTING_REGISTRATION_OBSERVATION_VERSION,
    packetId,
    revisionId,
    packetDigest: input.packetDigest,
    contentDigest: input.contentDigest,
    selectedVariantId: requireText(input.selectedVariantId, "selectedVariantId"),
    marketplace: input.marketplace,
    sellerProductId,
    registeredAt: new Date(input.registeredAt).toISOString(),
  } as const;
  if (core.marketplace !== "COUPANG_WING") throw new Error("unsupported marketplace");
  return Object.freeze({
    ...core,
    observationId: digest(core),
    learningStatus: "AWAITING_TRAFFIC",
    winnerDeclared: false,
  });
}

export function registrationObservationMetadata(
  observation: ListingRegistrationObservation,
): Readonly<Record<string, string | boolean>> {
  return Object.freeze({
    observationSchemaVersion: observation.schemaVersion,
    observationId: observation.observationId,
    packetId: observation.packetId,
    revisionId: observation.revisionId,
    packetDigest: observation.packetDigest,
    contentDigest: observation.contentDigest,
    selectedVariantId: observation.selectedVariantId,
    marketplace: observation.marketplace,
    sellerProductId: observation.sellerProductId,
    registeredAt: observation.registeredAt,
    learningStatus: observation.learningStatus,
    winnerDeclared: observation.winnerDeclared,
  });
}
