import {
  LISTING_EVIDENCE_SCHEMA_VERSION,
  type ListingEvidenceFact,
  type ListingEvidencePacket,
} from "../../shared/domain/listing-evidence.ts";

const SYNTHETIC_DIGEST = "a".repeat(64);

export function syntheticKk946Fact(overrides: Partial<ListingEvidenceFact> = {}): ListingEvidenceFact {
  return {
    factId: "synthetic-kk946-catalog-identity",
    subjectId: "KK946",
    field: "identityBinding",
    factClass: "CATALOG_CLAIM",
    value: "SYNTHETIC-KK946-IDENTITY",
    sourceType: "SUPPLIER_CATALOG",
    sourceReference: "fixture:synthetic-kk946-catalog-v1",
    evidenceDigest: SYNTHETIC_DIGEST,
    observedAt: "2026-08-05T00:00:00.000Z",
    capturedAt: "2026-08-05T00:00:01.000Z",
    status: "PROVEN",
    scope: "CATALOG_ITEM",
    scopeReference: "synthetic:catalog-item:KK946",
    validUntil: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

export function syntheticKk946Packet(overrides: Partial<ListingEvidencePacket> = {}): ListingEvidencePacket {
  return {
    schemaVersion: LISTING_EVIDENCE_SCHEMA_VERSION,
    subjectId: "KK946",
    evaluationId: "fixture-evaluation-kk946-v1",
    evaluatedAt: "2026-08-05T12:00:00.000Z",
    facts: [syntheticKk946Fact()],
    requiredFields: ["identityBinding"],
    ...overrides,
  };
}

export const quarantinedKk946Fixture: ListingEvidencePacket = syntheticKk946Packet({
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
