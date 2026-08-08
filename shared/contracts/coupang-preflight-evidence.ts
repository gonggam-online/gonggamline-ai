import type { CoupangCategorySnapshot } from "@/shared/contracts/coupang-category-snapshot";

export const COUPANG_EVIDENCE_SCHEMA_VERSION = "gonggamline-coupang-evidence-v1" as const;
export const COUPANG_EVIDENCE_RULESET_VERSION = "gonggamline-coupang-evidence-rules-v1" as const;

export type CoupangEvidenceErrorCode =
  | "CONFIGURATION_UNAVAILABLE"
  | "NETWORK_UNAVAILABLE"
  | "AUTHENTICATION_OR_SCOPE"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "RESPONSE_CONTRACT_ERROR"
  | "EVIDENCE_NOT_FOUND"
  | "EVIDENCE_CONFLICT"
  | "EVIDENCE_LIMIT_EXCEEDED"
  | "EVIDENCE_STALE";

export type EvidenceSource = Readonly<{
  observedAt: string;
  sourceUrl: string;
  schemaVersion: typeof COUPANG_EVIDENCE_SCHEMA_VERSION;
  rulesetVersion: typeof COUPANG_EVIDENCE_RULESET_VERSION;
  responseDigest: `sha256:${string}`;
}>;

export type OutboundLocationEvidence = Readonly<{
  vendorRef: string;
  outboundShippingPlaceCode: string;
  usable: true;
  source: EvidenceSource;
}>;

export type ReturnCenterEvidence = Readonly<{
  vendorRef: string;
  returnCenterCode: string;
  source: EvidenceSource;
}>;

export type MarketplacePreflightEvidenceV2 = Readonly<{
  categorySnapshot: CoupangCategorySnapshot;
  outbound: OutboundLocationEvidence;
  returnCenter: ReturnCenterEvidence;
  evidenceFingerprint: `sha256:${string}`;
}>;

export type EvidenceReadResult<T> =
  | Readonly<{ ok: true; evidence: T }>
  | Readonly<{ ok: false; code: CoupangEvidenceErrorCode }>;
