import type { EvidenceStatus, ListingEvidenceFact } from "@/shared/domain/listing-evidence";

export type ApprovedSupplierTrustProfile = Readonly<{
  profileId: string;
  sourceId: string;
  version: string;
  status: "ACTIVE" | "REVOKED";
  effectiveAt: string;
  capabilityDigest: string;
  supersedesVersion: string | null;
  allowedFactFields: readonly string[];
  capabilities: Readonly<{
    publicProductFacts: boolean;
    accountProductFacts: boolean;
    transactionTerms: boolean;
    options: boolean;
    manufacturerAndOrigin: boolean;
  }>;
  originalImageUse: "VERIFIED" | "UNKNOWN" | "PROHIBITED";
  imageEditRights: "VERIFIED" | "UNKNOWN" | "PROHIBITED";
  allowedChannels: readonly string[];
}>;

export type TrustedSupplierObservation = Readonly<{
  observationId: string;
  subjectId: string;
  field: string;
  value: string | number | boolean;
  sourceId: string;
  sourceReference: string;
  evidenceDigest: string;
  observedAt: string;
  capturedAt: string;
}>;

export type TrustedSupplierAdmission = Readonly<{
  facts: readonly ListingEvidenceFact[];
  warnings: readonly Readonly<{ code: "TRUST_PROFILE_REVIEW_REQUIRED" | "FRESHNESS_WARNING" | "FIELD_OUTSIDE_CAPABILITY"; path: string }>[];
  profileVersion: string;
}>;

export type SupplierTrustReevaluation = Readonly<{
  required: boolean;
  affectedFields: readonly string[];
  assetsAffected: boolean;
  reasons: readonly ("PROFILE_REVOKED" | "CAPABILITY_REDUCED" | "IMAGE_RIGHTS_REDUCED" | "CHANNEL_REMOVED")[];
}>;

export function evidenceStatusForProfile(profile: ApprovedSupplierTrustProfile): EvidenceStatus {
  return profile.status === "ACTIVE" ? "PROVEN" : "PROHIBITED";
}
