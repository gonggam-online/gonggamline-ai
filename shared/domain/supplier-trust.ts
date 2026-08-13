import type { EvidenceStatus, ListingEvidenceFact } from "@/shared/domain/listing-evidence";

export type ApprovedSupplierTrustProfile = Readonly<{
  profileId: string;
  sourceId: string;
  version: string;
  status: "ACTIVE" | "REVOKED";
  effectiveAt: string;
  allowedFactFields: readonly string[];
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

export function evidenceStatusForProfile(profile: ApprovedSupplierTrustProfile): EvidenceStatus {
  return profile.status === "ACTIVE" ? "PROVEN" : "PROHIBITED";
}
