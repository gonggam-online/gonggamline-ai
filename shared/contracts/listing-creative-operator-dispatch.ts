import type {
  ListingContentInput,
  RegistrationCommerceFields,
} from "@/shared/domain/listing-content";

export const LISTING_CREATIVE_OPERATOR_API_VERSION =
  "gonggamline-listing-creative-operator-api-v1" as const;

export type PrepareListingCreativeDispatchRequest = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_API_VERSION;
  listingInput: ListingContentInput;
  commerce: RegistrationCommerceFields;
  /** Explicit operator action for replacing an expired immutable plan. */
  reprepareExpiredPlanReference?: string;
}>;

export type AuthorizeListingCreativeDispatchRequest = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_API_VERSION;
  preparedPlanReference: string;
  confirmation: "AUTHORIZE_PAID_IMAGE_GENERATION";
}>;

export type ListingCreativeDispatchPreparedDto = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_OPERATOR_API_VERSION;
  status: "PREPARED";
  preparedPlanReference: string;
  dispatchPlanDigest: string;
  revisionDigest: string;
  expiresAt: string;
  providerId: string;
  modelVersion: string;
  termsVersion: string;
  pricingSnapshotVersion: string;
  estimatedMaximumCostUsd: number;
  maximumAuthorizedCostUsd: 2;
  outputCount: number;
  candidates: readonly Readonly<{
    candidateSetId: string;
    jobs: readonly Readonly<{
      role: "MAIN" | "ADDITIONAL" | "DETAIL";
      shotType: string;
      width: number;
      height: number;
    }>[];
  }>[];
}>;
