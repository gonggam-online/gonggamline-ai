export const LISTING_EVIDENCE_SCHEMA_VERSION =
  "gonggamline-listing-evidence-v1" as const;
export const LISTING_POLICY_RULESET_VERSION =
  "gonggamline-listing-policy-v1" as const;

export type ListingEvidenceStatus =
  | "PROVEN"
  | "UNKNOWN"
  | "CONFLICT"
  | "PROHIBITED"
  | "NOT_APPLICABLE";

export type ListingEvidenceScope =
  | "CATALOG_ITEM"
  | "PURCHASED_SKU"
  | "INBOUND_LOT"
  | "INSPECTED_UNIT"
  | "ASSET";

export type ListingEvidenceSource =
  | "SUPPLIER_CATALOG"
  | "TRANSACTION"
  | "THREE_PL_INSPECTION"
  | "COMPETENT_DOCUMENT"
  | "RIGHTS_GRANT"
  | "COUPANG_CATEGORY_METADATA";

export type ListingFactClass =
  | "CATALOG_CLAIM"
  | "TRANSACTION_TERM"
  | "PHYSICAL_OBSERVATION"
  | "DOCUMENTARY_FACT"
  | "IMAGE_USE_RIGHT"
  | "IMAGE_EDIT_RIGHT"
  | "COUPANG_CATEGORY_REQUIREMENT";

export interface ListingEvidenceFact {
  readonly factId: string;
  readonly subjectId: string;
  readonly field: string;
  readonly factClass: ListingFactClass;
  readonly value: string | number | boolean | null;
  readonly unit?: string;
  readonly locale?: string;
  readonly sourceType: ListingEvidenceSource;
  readonly sourceReference: string;
  readonly evidenceDigest: string;
  readonly observedAt: string;
  readonly capturedAt: string;
  readonly status: ListingEvidenceStatus;
  readonly scope: ListingEvidenceScope;
  readonly scopeReference: string;
  readonly validUntil?: string;
  readonly reviewerReference?: string;
}

export interface ListingEvidencePacket {
  readonly schemaVersion: typeof LISTING_EVIDENCE_SCHEMA_VERSION;
  readonly subjectId: string;
  readonly evaluationId: string;
  readonly evaluatedAt: string;
  readonly facts: readonly ListingEvidenceFact[];
  readonly requiredFields: readonly string[];
}

export type ListingPolicyIssueCode =
  | "UNKNOWN_REQUIRED_FACT"
  | "CONFLICTING_FACTS"
  | "PROHIBITED_FACT"
  | "WRONG_AUTHORITY"
  | "SCOPE_MISMATCH"
  | "STALE_EVIDENCE"
  | "INVALID_ENCODING"
  | "INVALID_EVIDENCE";

export interface ListingPolicyIssue {
  readonly code: ListingPolicyIssueCode;
  readonly field: string;
  readonly factIds: readonly string[];
}

export interface ListingPolicyDecision {
  readonly rulesetVersion: typeof LISTING_POLICY_RULESET_VERSION;
  readonly subjectId: string;
  readonly evaluationId: string;
  readonly disposition: "ADMITTED" | "QUARANTINED";
  readonly admittedFacts: readonly ListingEvidenceFact[];
  readonly issues: readonly ListingPolicyIssue[];
}
