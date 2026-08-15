import type {
  ComputedArtifactReview,
  CreativeRenderJob,
} from "@/shared/domain/listing-creative";
import type { ArchivedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";

export const LISTING_CREATIVE_OPERATOR_VERSION =
  "gonggamline-listing-creative-operator-v1" as const;

export type ListingCreativeOperatorPlanReference = Readonly<{
  subjectHash: string;
  revisionDigest: string;
  dispatchPlanDigest: string;
}>;

export type ListingCreativeOperatorFact = Readonly<{
  field: string;
  value: string;
  factIds: readonly string[];
}>;

export type ListingCreativeOperatorContentBinding = Readonly<{
  variantIds: readonly [string, string];
  filterSetDigest: string;
}>;

export type PreparedListingCreativeDispatchPlan = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_VERSION;
  status: "PREPARED";
  reference: ListingCreativeOperatorPlanReference;
  planIntegrityDigest: string;
  packetIdDigest: string;
  evidenceEvaluationId: string;
  policyDigest: string;
  categoryMetadataDigest: string;
  contentBinding: ListingCreativeOperatorContentBinding;
  facts: readonly ListingCreativeOperatorFact[];
  jobs: readonly CreativeRenderJob[];
  providerId: string;
  modelVersion: string;
  termsVersion: string;
  pricingSnapshotVersion: string;
  estimatedMaximumCostUsd: number;
  maximumAuthorizedCostUsd: 2;
  maximumOutputs: 6;
  preparedByAdministratorHash: string;
  preparedAt: string;
  expiresAt: string;
  /** Present only for an explicit post-expiry re-prepare attempt. */
  preparationAttemptDigest?: string;
}>;

export type ListingCreativeDispatchAuthorization = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_VERSION;
  status: "AUTHORIZED";
  planReference: ListingCreativeOperatorPlanReference;
  authorizationDigest: string;
  administratorSubjectHash: string;
  csrfPurpose: "listing-creative-dispatch";
  confirmation: "AUTHORIZE_PAID_IMAGE_GENERATION";
  providerId: string;
  modelVersion: string;
  termsVersion: string;
  pricingSnapshotVersion: string;
  maximumCostUsd: 2;
  maximumOutputs: 6;
  authorizedAt: string;
  expiresAt: string;
}>;

export type ListingCreativeWholePlanReservation = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_VERSION;
  status: "RESERVED";
  planReference: ListingCreativeOperatorPlanReference;
  authorizationDigest: string;
  reservedAt: string;
  reservationDigest: string;
}>;

export type ListingCreativeOperatorReviewArtifact = Readonly<{
  artifactId: string;
  candidateSetId: string;
  role: "MAIN" | "ADDITIONAL" | "DETAIL";
  shotType: string;
  byteDigest: string;
  byteSize: number;
  width: number;
  height: number;
  mimeType: "image/png";
  altText: string;
  factIds: readonly string[];
  computedReview: ComputedArtifactReview;
  computedQaDigest: string;
  providerExecutionDigest: string;
  operation: "GENERATE";
  inputImageTokens: 0;
  archived: ArchivedListingCreativeAsset;
}>;

export type ListingCreativeOperatorReviewHandoff = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_VERSION;
  status: "REVIEW_REQUIRED";
  planReference: ListingCreativeOperatorPlanReference;
  authorizationDigest: string;
  reservationDigest: string;
  evidenceEvaluationId: string;
  policyDigest: string;
  categoryMetadataDigest: string;
  contentBinding: ListingCreativeOperatorContentBinding;
  facts: readonly ListingCreativeOperatorFact[];
  artifacts: readonly ListingCreativeOperatorReviewArtifact[];
  candidateSetIds: readonly [string, string];
  selectedCandidateSetId: null;
  contentApproved: false;
  liveWriteApproved: false;
  requiredHumanReviewFields: readonly [
    "productIdentity",
    "color",
    "quantity",
    "dimensionsAndScale",
    "material",
    "components",
    "optionConsistency",
    "prohibitedMarks",
    "unsupportedClaims",
    "crop",
    "encoding",
    "load",
  ];
  createdAt: string;
  handoffDigest: string;
}>;

export type ListingCreativeOperatorReviewDto = Readonly<{
  status: "REVIEW_REQUIRED";
  dispatchPlanDigest: string;
  revisionDigest: string;
  handoffDigest: string;
  facts: readonly ListingCreativeOperatorFact[];
  candidateSetIds: readonly [string, string];
  artifacts: readonly Readonly<{
    artifactId: string;
    candidateSetId: string;
    role: "MAIN" | "ADDITIONAL" | "DETAIL";
    byteDigest: string;
    width: number;
    height: number;
    mimeType: "image/png";
    altText: string;
    signedReviewUrl: string;
    signedReviewUrlTtlSeconds: number;
    computedReview: ComputedArtifactReview;
    humanReview: "REVIEW_REQUIRED";
  }>[];
  selectedCandidateSetId: null;
  contentApproved: false;
  liveWriteApproved: false;
}>;
