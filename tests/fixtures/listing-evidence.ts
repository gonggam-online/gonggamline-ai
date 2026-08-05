import {
  LISTING_EVIDENCE_SCHEMA_VERSION,
  type ListingEvidenceFact,
  type ListingEvidencePacket,
} from "../../shared/domain/listing-evidence.ts";

const SYNTHETIC_DIGEST = "a".repeat(64);

export function syntheticKk946Fact(
  overrides: Partial<ListingEvidenceFact> = {},
): ListingEvidenceFact {
  return {
    factId: "synthetic-kk946-catalog-identity",
    subjectId: "SYNTHETIC-KK946-SHAPED",
    field: "identityBinding",
    factClass: "CATALOG_CLAIM",
    value: "SYNTHETIC-KK946-IDENTITY",
    sourceType: "SUPPLIER_CATALOG",
    sourceReference: "fixture:synthetic-kk946-shaped:catalog-v1",
    evidenceDigest: SYNTHETIC_DIGEST,
    observedAt: "2026-08-05T00:00:00.000Z",
    capturedAt: "2026-08-05T00:00:01.000Z",
    status: "PROVEN",
    scope: "CATALOG_ITEM",
    scopeReference: "synthetic:catalog-item:kk946-shaped",
    validUntil: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

export function syntheticKk946Packet(
  overrides: Partial<ListingEvidencePacket> = {},
): ListingEvidencePacket {
  return {
    schemaVersion: LISTING_EVIDENCE_SCHEMA_VERSION,
    subjectId: "SYNTHETIC-KK946-SHAPED",
    evaluationId: "fixture:synthetic-kk946-shaped:evaluation-v1",
    evaluatedAt: "2026-08-05T12:00:00.000Z",
    facts: [syntheticKk946Fact()],
    requiredFields: ["identityBinding"],
    ...overrides,
  };
}

export const unknownKk946ShapedFixture: ListingEvidencePacket =
  syntheticKk946Packet({
    facts: [],
    requiredFields: [
      "identityBinding",
      "supplierCatalogSnapshot",
      "purchaseAndLotBinding",
      "threePlInspection",
      "imageUseRights",
      "imageEditRights",
      "coupangCategoryContract",
      "productNoticeFacts",
    ],
  });
