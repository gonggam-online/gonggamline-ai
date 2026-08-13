import type { CoupangCategorySnapshot } from "@/shared/contracts/coupang-category-snapshot";
import type { ListingEvidencePacket } from "@/shared/domain/listing-evidence";

export const LISTING_CONTENT_PACKET_VERSION = "gonggamline-listing-content-v2" as const;

export type ContentProvenance = Readonly<{
  factIds: readonly string[];
  policyRuleIds: readonly string[];
}>;

export type MarketplacePolicySnapshot = Readonly<{
  snapshotId: string;
  observedAt: string;
  digest: string;
  titleMaxLength: number;
  keywordMaxCount: number;
  keywordMaxLength: number;
  forbiddenTerms: readonly string[];
  competitorMarks: readonly string[];
  prohibitedClaimPatterns: readonly string[];
  sources: readonly Readonly<{ sourceId: string; url: string; observedAt: string; appliesTo: string; limitation: string; version: string; digest: string }>[];
}>;

export type ListingAssetRole = "MAIN" | "ADDITIONAL" | "DETAIL";
export type ListingAssetTransformation =
  | "NONE"
  | "CROP"
  | "BACKGROUND_REMOVAL"
  | "TEXT_OVERLAY"
  | "COMPOSITE"
  | "GENERATIVE_REFERENCE";

export type RightsStatus = "VERIFIED" | "UNKNOWN" | "PROHIBITED" | "REVOKED";

export type ListingSourceAsset = Readonly<{
  assetId: string;
  digest: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
  sourceReference: string;
  provenanceFactIds: readonly string[];
  creatorReference: string;
  rightsHolderReference: string;
  useRights: RightsStatus;
  editRights: RightsStatus;
  permittedChannels: readonly string[];
  permittedTransformations: readonly ListingAssetTransformation[];
  productAccuracyStatus: "VERIFIED" | "UNKNOWN" | "CONFLICT";
  altText: string;
}>;

export type ListingAssetRequest = Readonly<{
  sourceAssetId: string;
  outputAssetId: string;
  role: ListingAssetRole;
  transformation: ListingAssetTransformation;
  outputDigest: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: ListingSourceAsset["mimeType"];
  altText: string;
}>;

export type ListingAssetManifestEntry = ListingAssetRequest & Readonly<{
  disposition: "INCLUDED" | "DERIVATIVE_UNAVAILABLE";
  provenanceFactIds: readonly string[];
  sourceReference: string;
  useRights: RightsStatus;
  editRights: RightsStatus;
  review: Readonly<{
    dimensions: "PASS" | "FAIL";
    mime: "PASS" | "FAIL";
    digest: "PASS" | "FAIL";
    rights: "PASS" | "FAIL";
    productAccuracy: "PASS" | "FAIL";
    altText: "PASS" | "FAIL";
  }>;
}>;

export type ProvenancedText = Readonly<{
  text: string;
  provenance: ContentProvenance;
}>;

export type ListingContentInput = Readonly<{
  packetId: string;
  subjectId: string;
  evidence: ListingEvidencePacket;
  category: CoupangCategorySnapshot;
  policy: MarketplacePolicySnapshot;
  titleFieldOrder: readonly string[];
  minimumRequiredFields: readonly string[];
  corePurchaseFields: readonly string[];
  keywordFields: readonly string[];
  customerIntents: readonly Readonly<{ intentId: string; query: string; attributeFields: readonly string[] }>[];
  detailClaims: readonly Readonly<{ heading: string; field: string }>[];
  sourceAssets: readonly ListingSourceAsset[];
  assetRequests: readonly ListingAssetRequest[];
  contentApproval?: Readonly<{
    decision: "APPROVED_FOR_PAYLOAD_MAPPING";
    reviewerReference: string;
    evidenceEvaluationId: string;
    policyDigest: string;
    categoryMetadataDigest: string;
  }>;
}>;

export type RegistrationCommerceFields = Readonly<{
  liveWriteApproval: Readonly<{ approved: boolean; approvalReference: string; payloadDigest?: string }>;
  vendorUserId: string;
  displayCategoryCode: number;
  saleStartedAt: string;
  saleEndedAt: string;
  deliveryMethod: string;
  deliveryChargeType: string;
  outboundShippingPlaceCode: string;
  returnCenterCode: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  originalPrice: number;
  salePrice: number;
  maximumBuyCount: number;
  stockQuantity: number;
  notices: readonly Readonly<{ name: string; value: string; factIds: readonly string[] }>[];
  attributes: readonly Readonly<{ name: string; value: string; factIds: readonly string[] }>[];
}>;

export type ListingPipelineIssue = Readonly<{
  code: string;
  path: string;
  message: string;
  severity: "BLOCKER" | "WARNING" | "OPTIMIZATION_PENDING";
}>;

export type ListingContentPacket = Readonly<{
  schemaVersion: typeof LISTING_CONTENT_PACKET_VERSION;
  packetId: string;
  subjectId: string;
  status: "REGISTRATION_BLOCKED" | "OPTIMIZATION_PENDING" | "REGISTRATION_READY";
  title: Readonly<{ value: string; tokens: readonly ProvenancedText[] }>;
  keywords: readonly ProvenancedText[];
  conversion: Readonly<{
    objective: "QUALIFIED_CONVERSION_AND_ATTRIBUTABLE_PROFIT";
    readiness: "COLD_START" | "LEARNING" | "EVIDENCE_BACKED";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    candidates: readonly Readonly<{
      variantId: string;
      title: string;
      keywords: readonly string[];
      creativePlan: readonly ("PACKSHOT" | "ANGLE" | "SCALE" | "CONTEXT" | "FEATURE" | "COMPONENTS" | "DETAIL")[];
      rationale: readonly string[];
    }>[];
    selectedVariantId: string;
    sourceSnapshotIds: readonly string[];
    learningPlan: Readonly<{ method: "SEQUENTIAL_REVISION"; approvalRequired: true; parallelDuplicateListings: false; profitAndReturnGuardrailsRequired: true }>;
  }>;
  detailPage: Readonly<{
    mimeType: "text/html";
    width: 780;
    html: string;
    digest: string;
    blocks: readonly ProvenancedText[];
    review: Readonly<{
      encoding: "PASS" | "FAIL";
      mobileWidth: "PASS" | "FAIL";
      readability: "PASS" | "FAIL";
      assetReferences: "PASS" | "FAIL";
      claims: "PASS" | "FAIL";
    }>;
  }>;
  assets: readonly ListingAssetManifestEntry[];
  issues: readonly ListingPipelineIssue[];
  registrationPayload: Record<string, unknown> | null;
  approval: Readonly<{ contentApproved: boolean; livePublishAuthorized: boolean }>;
}>;
