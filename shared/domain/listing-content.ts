import type { CoupangCategorySnapshot } from "@/shared/contracts/coupang-category-snapshot";
import type { ListingEvidencePacket } from "@/shared/domain/listing-evidence";

export const LISTING_CONTENT_PACKET_VERSION = "gonggamline-listing-content-v2" as const;

export type ContentProvenance = Readonly<{
  factIds: readonly string[];
  policyRuleIds: readonly string[];
}>;

export type ConversionEvidenceKind =
  | "COUPANG_OFFICIAL"
  | "CATEGORY_MARKET_OBSERVATION"
  | "COMMERCE_UX_RESEARCH"
  | "SELLER_ACTUAL_METRICS";

export type MarketplacePolicySource = Readonly<{
  sourceId: string;
  kind: ConversionEvidenceKind;
  priority: 1 | 2 | 3 | 4;
  url: string;
  observedAt: string;
  appliesTo: string;
  limitation: string;
  version: string;
  digest: string;
}>;

export type MarketplacePolicySnapshot = Readonly<{
  snapshotId: string;
  observedAt: string;
  digest: string;
  titleMaxLength: number;
  keywordMaxCount: number;
  keywordMaxLength: number;
  keywordAllowedPattern: string;
  mainImageMinimumPixels: number;
  mainImageRecommendedPixels: number;
  additionalImageMaxCount: number;
  allowedImageMimeTypes: readonly ListingSourceAsset["mimeType"][];
  imageMaxByteSize: number;
  forbiddenTerms: readonly string[];
  competitorMarks: readonly string[];
  prohibitedClaimPatterns: readonly string[];
  sources: readonly MarketplacePolicySource[];
}>;

export type ListingAssetRole = "MAIN" | "ADDITIONAL" | "DETAIL";
export type ListingShotType = "PACKSHOT" | "ANGLE" | "SCALE" | "CONTEXT" | "FEATURE" | "COMPONENTS" | "DETAIL";
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
  outputReference: string;
  transformationReference: string;
  outputRightsReference: string;
  providerApprovalReference: string | null;
  role: ListingAssetRole;
  shotType: ListingShotType;
  transformation: ListingAssetTransformation;
  outputDigest: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: ListingSourceAsset["mimeType"];
  altText: string;
  renderedReview: Readonly<{ load: "PASS" | "FAIL"; crop: "PASS" | "FAIL"; background: "PASS" | "FAIL"; promotionalText: "PASS" | "FAIL" }>;
}>;

export type ListingAssetManifestEntry = ListingAssetRequest & Readonly<{
  disposition: "INCLUDED" | "EXCLUDED" | "DERIVATIVE_UNAVAILABLE";
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
    load: "PASS" | "FAIL";
    crop: "PASS" | "FAIL";
    bytes: "PASS" | "FAIL";
    background: "PASS" | "FAIL";
    promotionalText: "PASS" | "FAIL";
  }>;
}>;

export type ProvenancedText = Readonly<{
  text: string;
  field: string;
  rank: number;
  rationale: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  provenance: ContentProvenance;
}>;

export type CustomerIntentTaxonomy = "DISCOVERY" | "FIT" | "FEATURE" | "USE_CASE" | "RISK_REDUCTION";
export type MobileDetailBlockType = "IDENTITY" | "VERIFIED_BENEFIT" | "SPECIFICATION" | "USE_CONTEXT" | "OBJECTION" | "FULFILLMENT" | "NOTICE";

export type OwnerApprovedFallback = Readonly<{
  targetField: string;
  value: string;
  assumption: string;
  approvalReference: string;
  provenanceFactIds: readonly string[];
  categoryAllowsFallback: boolean;
}>;

export type CategoryMarketObservation = Readonly<{
  observationId: string;
  categoryCode: string;
  observedAt: string;
  digest: string;
  sourceReferences: readonly string[];
  limitation: string;
  attributeFields: readonly string[];
  publicSignals: Readonly<{ priceObserved: boolean; imageShotTypes: readonly ListingShotType[]; reviewAndDeliverySignalsObserved: boolean }>;
  copiedTextOrImage: false;
}>;

export type ListingContentInput = Readonly<{
  packetId: string;
  subjectId: string;
  evidence: ListingEvidencePacket;
  category: CoupangCategorySnapshot;
  policy: MarketplacePolicySnapshot;
  supplierTrust: Readonly<{ profileId: string; sourceId: string; version: string; capabilityDigest: string; status: "ACTIVE" | "REVOKED" }>;
  titleFieldOrder: readonly string[];
  minimumRequiredFields: readonly string[];
  corePurchaseFields: readonly string[];
  creativeFactFields: readonly string[];
  keywordFields: readonly string[];
  customerIntents: readonly Readonly<{ intentId: string; query: string; attributeFields: readonly string[] }>[];
  queryAttributeMappings: readonly Readonly<{ query: string; taxonomy: CustomerIntentTaxonomy; field: string; priority: number; sourceIds: readonly string[] }>[];
  marketObservations: readonly CategoryMarketObservation[];
  detailClaims: readonly Readonly<{ blockType: MobileDetailBlockType; heading: string; field: string; priority: number }>[];
  ownerApprovedFallbacks: readonly OwnerApprovedFallback[];
  sourceAssets: readonly ListingSourceAsset[];
  assetRequests: readonly ListingAssetRequest[];
  contentApproval?: Readonly<{
    decision: "APPROVED_FOR_PAYLOAD_MAPPING";
    reviewerReference: string;
    evidenceEvaluationId: string;
    policyDigest: string;
    categoryMetadataDigest: string;
    selectedVariantId: string;
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
  options: readonly Readonly<{ name: string; value: string; factIds: readonly string[] }>[];
  searchFilters: readonly Readonly<{ name: string; value: string; factIds: readonly string[] }>[];
}>;

export type ListingPipelineIssue = Readonly<{
  code: string;
  path: string;
  message: string;
  severity: "BLOCKER" | "WARNING" | "OPTIMIZATION_PENDING";
  blockerClass: "REQUIRED_FIELD_MISSING" | "CORE_FACT_CONFLICT" | "PROHIBITED_PAYLOAD_CONTENT" | "PAYLOAD_VALIDATION_FAILED" | "LIVE_WRITE_APPROVAL_MISSING" | null;
}>;

export type ListingContentPacket = Readonly<{
  schemaVersion: typeof LISTING_CONTENT_PACKET_VERSION;
  packetId: string;
  subjectId: string;
  supplierTrust: ListingContentInput["supplierTrust"];
  status: "REGISTRATION_BLOCKED" | "OPTIMIZATION_PENDING" | "REGISTRATION_READY";
  title: Readonly<{ value: string; tokens: readonly ProvenancedText[] }>;
  keywords: readonly ProvenancedText[];
  selectedVariantId: string;
  conversion: Readonly<{
    objective: "QUALIFIED_CONVERSION_AND_ATTRIBUTABLE_PROFIT";
    readiness: "COLD_START" | "LEARNING" | "EVIDENCE_BACKED";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    candidates: readonly Readonly<{
      variantId: string;
      title: string;
      titleTokens: readonly ProvenancedText[];
      keywords: readonly string[];
      keywordCandidates: readonly ProvenancedText[];
      creativePlan: readonly ListingShotType[];
      detailPlan: readonly MobileDetailBlockType[];
      rationale: readonly string[];
      confidence: "LOW" | "MEDIUM" | "HIGH";
    }>[];
    selectedVariantId: string;
    sourceSnapshotIds: readonly string[];
    sourceSnapshots: readonly MarketplacePolicySource[];
    marketObservations: readonly CategoryMarketObservation[];
    optimizationRationale: readonly string[];
    learningPlan: Readonly<{ method: "SEQUENTIAL_REVISION"; approvalRequired: true; parallelDuplicateListings: false; profitAndReturnGuardrailsRequired: true; rollbackPlan: string }>;
  }>;
  detailPage: Readonly<{
    mimeType: "text/html";
    width: 780;
    html: string;
    digest: string;
    blocks: readonly (ProvenancedText & Readonly<{ blockType: MobileDetailBlockType; heading: string }>)[];
    review: Readonly<{
      encoding: "PASS" | "FAIL";
      mobileWidth: "PASS" | "FAIL";
      readability: "PASS" | "FAIL";
      assetReferences: "PASS" | "FAIL";
      claims: "PASS" | "FAIL";
      crop: "PASS" | "FAIL";
      productFacts: "PASS" | "FAIL";
      load: "PASS" | "FAIL";
    }>;
  }>;
  assets: readonly ListingAssetManifestEntry[];
  assumptions: readonly OwnerApprovedFallback[];
  generation: Readonly<{ mode: "DETERMINISTIC"; externalTextProviderUsed: false; generatedAssetCount: number; providerApprovalRequiredForGenerativeReference: true }>;
  issues: readonly ListingPipelineIssue[];
  registrationPayload: Record<string, unknown> | null;
  approval: Readonly<{ contentApproved: boolean; livePublishAuthorized: boolean }>;
}>;
