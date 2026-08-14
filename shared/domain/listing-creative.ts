import type {
  ListingAssetRole,
  ListingAssetTransformation,
  ListingShotType,
} from "@/shared/domain/listing-content";

export const LISTING_CREATIVE_PACKET_VERSION =
  "gonggamline-listing-creative-v3" as const;

export type CreativeRightsDecision = "VERIFIED" | "DENIED" | "UNKNOWN";

export type CreativeSourceClass =
  | "APPROVED_SUPPLIER"
  | "OWN_PHOTOGRAPHY"
  | "COMMISSIONED"
  | "OPEN_LICENSE"
  | "PUBLIC_DOMAIN"
  | "MARKET_OBSERVATION"
  | "GENERATED_ORIGINAL";

export type CreativeRightsCapabilities = Readonly<{
  commercialUnchangedUse: CreativeRightsDecision;
  marketplaceRedistribution: CreativeRightsDecision;
  technicalReencode: CreativeRightsDecision;
  resizeResample: CreativeRightsDecision;
  crop: CreativeRightsDecision;
  backgroundRemoval: CreativeRightsDecision;
  textOverlay: CreativeRightsDecision;
  composite: CreativeRightsDecision;
  providerUpload: CreativeRightsDecision;
  generativeReference: CreativeRightsDecision;
  syntheticOutputCommercialUse: CreativeRightsDecision;
}>;

export type CreativeProviderKind =
  | "DETERMINISTIC_FIXTURE"
  | "EXTERNAL_IMAGE_PROVIDER";

export type CreativeProviderApproval = Readonly<{
  providerKind: CreativeProviderKind;
  providerId: string;
  modelVersion: string;
  termsVersion: string;
  approvalReference: string | null;
  paidUsageApproved: boolean;
  serverSecretApproved: boolean;
  managedAssetStoreApproved: boolean;
  outputCommercialUseApproved: boolean;
}>;

export type CreativeProviderExecution = Readonly<{
  operation: "GENERATE" | "EDIT";
  requestHash: string;
  promptDigest: string;
  requestedAt: string;
  sanitizedProviderRequestHash: string | null;
  quality: "LOW" | "MEDIUM" | "HIGH";
  pricingSnapshotVersion: string;
  estimatedCostUsd: number;
  actualCostUsd: number | null;
  usage: Readonly<{
    inputTextTokens: number | null;
    inputImageTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  }>;
}>;

export type CreativeSourceAuthorization = Readonly<{
  assetDigest: string;
  sourceClass: CreativeSourceClass;
  rights: CreativeRightsCapabilities;
  grantReference: string;
  snapshotVersion: string;
  snapshotDigest: string;
  expiresAt: string | null;
  revokedAt: string | null;
}>;

export type CreativeRenderJob = Readonly<{
  jobId: string;
  candidateSetId: string;
  subjectReference: string;
  role: ListingAssetRole;
  shotType: ListingShotType;
  transformation: ListingAssetTransformation | "FACT_ONLY_SYNTHETIC";
  inputAssetDigests: readonly string[];
  inputSources: readonly CreativeSourceAuthorization[];
  factIds: readonly string[];
  width: number;
  height: number;
  mimeType: "image/png";
  altText: string;
  factualConstraints: readonly string[];
  renderRecipeVersion: string;
  provider: CreativeProviderApproval;
}>;

export type ComputedArtifactReview = Readonly<{
  decode: "PASS" | "FAIL";
  digest: "PASS" | "FAIL";
  mime: "PASS" | "FAIL";
  dimensions: "PASS" | "FAIL";
  mobileSafe: "PASS" | "FAIL";
  sourceRights: "PASS" | "FAIL";
  deployability: "PASS" | "FAIL";
}>;

export type RenderedCreativeArtifact = Readonly<{
  artifactId: string;
  candidateSetId: string;
  jobId: string;
  role: ListingAssetRole;
  shotType: ListingShotType;
  byteDigest: string;
  byteSize: number;
  width: number;
  height: number;
  mimeType: "image/png";
  previewDataUrl: string;
  durableAssetReference: string | null;
  altText: string;
  factIds: readonly string[];
  inputAssetDigests: readonly string[];
  renderRecipeVersion: string;
  providerKind: CreativeProviderKind;
  providerId: string;
  providerApprovalReference: string | null;
  providerModelVersion: string;
  providerTermsVersion: string;
  providerExecution: CreativeProviderExecution | null;
  deployability: "FIXTURE_ONLY" | "NONDEPLOYABLE" | "DEPLOYABLE";
  review: ComputedArtifactReview;
}>;

export type CreativeCandidateSet = Readonly<{
  candidateSetId: string;
  label: string;
  rationale: readonly string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  titleCandidateId: string;
  keywordCandidateId: string;
  renderJobs: readonly CreativeRenderJob[];
  artifacts: readonly RenderedCreativeArtifact[];
}>;

export type ListingCreativeReviewPacket = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_PACKET_VERSION;
  packetId: string;
  subjectReference: string;
  evidenceEvaluationId: string;
  policyDigest: string;
  categoryMetadataDigest: string;
  revisionId: string;
  registrationReadiness: "PASS" | "BLOCKED";
  conversionReadiness:
    | "FIXTURE_PREVIEW"
    | "OPTIMIZATION_PENDING"
    | "REVIEW_READY";
  candidates: readonly CreativeCandidateSet[];
  selectedCandidateSetId: string | null;
  contentApproval: Readonly<{
    approved: boolean;
    approvalReference: string | null;
    boundArtifactDigests: readonly string[];
    boundEvidenceEvaluationId: string | null;
    boundPolicyDigest: string | null;
    boundCategoryMetadataDigest: string | null;
    boundCandidateSetId: string | null;
    boundTitleCandidateId: string | null;
    boundKeywordCandidateId: string | null;
    boundRenderRecipeVersions: readonly string[];
    boundRevisionId: string | null;
  }>;
  liveWriteApproval: Readonly<{
    approved: boolean;
    approvalReference: string | null;
  }>;
  issues: readonly Readonly<{
    code: string;
    severity:
      | "BLOCKER"
      | "WARNING"
      | "OPTIMIZATION_PENDING"
      | "DERIVATIVE_UNAVAILABLE";
    path: string;
    message: string;
  }>[];
}>;
