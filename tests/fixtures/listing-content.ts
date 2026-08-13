import type { CoupangCategorySnapshot } from "../../shared/contracts/coupang-category-snapshot.ts";
import type { ListingContentInput, RegistrationCommerceFields } from "../../shared/domain/listing-content.ts";
import { LISTING_EVIDENCE_SCHEMA_VERSION, type ListingEvidenceFact } from "../../shared/domain/listing-evidence.ts";
import { createCoupangMarketplacePolicySnapshotV20260813 } from "../../engines/listing/marketplace-policy.ts";
import { digestCanonicalJson } from "../../engines/listing/category-snapshot.ts";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

function fact(field: string, value: string | number, index: number, physical = false): ListingEvidenceFact {
  return {
    factId: `fixture-fact-${index}`,
    subjectId: "SYNTHETIC-PRODUCT-01",
    field,
    factClass: physical ? "PHYSICAL_OBSERVATION" : "CATALOG_CLAIM",
    value,
    sourceType: physical ? "THREE_PL_INSPECTION" : "SUPPLIER_CATALOG",
    sourceReference: physical ? "fixture:inspection:lot-01" : "fixture:catalog:item-01",
    evidenceDigest: DIGEST_A,
    observedAt: "2026-08-12T00:00:00.000Z",
    capturedAt: "2026-08-12T00:00:01.000Z",
    status: "PROVEN",
    scope: physical ? "INSPECTED_UNIT" : "CATALOG_ITEM",
    scopeReference: physical ? "fixture:unit:01" : "fixture:catalog-item:01",
  };
}

export const genericCategorySnapshot: CoupangCategorySnapshot = {
  schemaVersion: "gonggamline-coupang-category-snapshot-v1",
  rulesetVersion: "gonggamline-coupang-category-snapshot-rules-v1",
  displayCategoryCode: "77701",
  channel: "MARKETPLACE",
  observedAt: "2026-08-12T00:00:00.000Z",
  metadataDigest: DIGEST_A,
  validityDigest: DIGEST_B,
  categoryValid: true,
  isAllowSingleItem: true,
  attributes: [{ attributeTypeName: "색상", required: "MANDATORY", dataType: "STRING", basicUnit: "없음", inputType: "INPUT", inputValues: [], usableUnits: [], groupNumber: "1", exposed: "EXPOSED" }],
  noticeCategories: [{ noticeCategoryName: "기타 재화", detailNames: [{ noticeCategoryDetailName: "품명 및 모델명", required: "MANDATORY" }] }],
  requiredDocuments: [], certifications: [], allowedOfferConditions: ["NEW"], selectedNoticeCategoryName: "기타 재화", disposition: "VALIDATED", issues: [],
};

export function genericListingInput(): ListingContentInput {
  const facts = [fact("productName", "정리 파우치", 1), fact("modelName", "GL-01", 2), fact("color", "네이비", 3, true), fact("material", "폴리에스터", 4), fact("dimensions", "12 × 5 × 8 cm", 5, true), fact("keywords", "소형 파우치", 6)];
  const policyBase = createCoupangMarketplacePolicySnapshotV20260813();
  const { digest: _baseDigest, ...policyFields } = policyBase;
  void _baseDigest;
  const policyWithoutDigest = { ...policyFields, competitorMarks: ["경쟁사상표"] };
  const policy = { ...policyWithoutDigest, digest: digestCanonicalJson(policyWithoutDigest) ?? "" };
  const marketObservationBody = { observationId: "fixture-market-observation-01", categoryCode: "77701", observedAt: "2026-08-12T00:00:00.000Z", sourceReferences: ["https://example.invalid/public-category-observation"], limitation: "synthetic pattern-only observation; no text or image is copied", attributeFields: ["productName", "dimensions"], publicSignals: { priceObserved: true, imageShotTypes: ["PACKSHOT", "SCALE"] as const, reviewAndDeliverySignalsObserved: true }, copiedTextOrImage: false as const };
  const marketObservation = { ...marketObservationBody, digest: digestCanonicalJson(marketObservationBody) ?? "" };
  return {
    packetId: "fixture-packet-generic-01", subjectId: "SYNTHETIC-PRODUCT-01",
    evidence: { schemaVersion: LISTING_EVIDENCE_SCHEMA_VERSION, subjectId: "SYNTHETIC-PRODUCT-01", evaluationId: "fixture-evaluation-generic-01", evaluatedAt: "2026-08-13T00:00:00.000Z", facts, requiredFields: facts.map(({ field }) => field) },
    category: genericCategorySnapshot,
    policy,
    supplierTrust: { profileId: "fixture-approved-wholesale", sourceId: "fixture-wholesale", version: "2026-08-13.v1", capabilityDigest: DIGEST_A, status: "ACTIVE" },
    titleFieldOrder: ["productName", "modelName", "color"], minimumRequiredFields: ["productName", "color"], corePurchaseFields: ["modelName", "color"], keywordFields: ["productName", "keywords", "color"], customerIntents: [{ intentId: "organize-small-items", query: "소형 물품 정리", attributeFields: ["productName", "dimensions"] }, { intentId: "verify-size", query: "크기 확인", attributeFields: ["dimensions"] }],
    queryAttributeMappings: [{ query: "소형 물품 정리", taxonomy: "USE_CASE", field: "productName", priority: 3, sourceIds: ["coupang-marketplace-search-guide"] }, { query: "크기 확인", taxonomy: "FIT", field: "dimensions", priority: 2, sourceIds: ["baymard-product-image-text-research"] }],
    marketObservations: [marketObservation],
    detailClaims: [{ blockType: "IDENTITY", heading: "상품", field: "productName", priority: 10 }, { blockType: "SPECIFICATION", heading: "소재", field: "material", priority: 8 }, { blockType: "SPECIFICATION", heading: "크기", field: "dimensions", priority: 9 }, { blockType: "SPECIFICATION", heading: "색상", field: "color", priority: 7 }],
    ownerApprovedFallbacks: [],
    sourceAssets: [{ assetId: "fixture-source-main", digest: DIGEST_A, width: 1200, height: 1200, byteSize: 40000, mimeType: "image/jpeg", sourceReference: "fixture:asset:rights-cleared-main.jpg", provenanceFactIds: ["fixture-fact-1", "fixture-fact-3"], creatorReference: "fixture:creator:studio", rightsHolderReference: "fixture:rights-holder:studio", useRights: "VERIFIED", editRights: "VERIFIED", permittedChannels: ["COUPANG"], permittedTransformations: ["NONE", "CROP"], productAccuracyStatus: "VERIFIED", altText: "네이비 정리 파우치 대표 이미지" }],
    assetRequests: [
      { sourceAssetId: "fixture-source-main", outputAssetId: "fixture-output-main", outputReference: "fixture:asset:rights-cleared-main.jpg", transformationReference: "NONE", outputRightsReference: "fixture:rights-holder:studio", providerApprovalReference: null, role: "MAIN", shotType: "PACKSHOT", transformation: "NONE", outputDigest: DIGEST_A, width: 1200, height: 1200, byteSize: 40000, mimeType: "image/jpeg", altText: "네이비 정리 파우치 대표 이미지", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
      { sourceAssetId: "fixture-source-main", outputAssetId: "fixture-output-detail", outputReference: "fixture:asset:rights-cleared-detail.jpg", transformationReference: "fixture:transform:crop-v1", outputRightsReference: "fixture:rights-holder:studio", providerApprovalReference: null, role: "DETAIL", shotType: "DETAIL", transformation: "CROP", outputDigest: DIGEST_B, width: 780, height: 780, byteSize: 30000, mimeType: "image/jpeg", altText: "네이비 정리 파우치 상세 이미지", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
    ],
    contentApproval: { decision: "APPROVED_FOR_PAYLOAD_MAPPING", reviewerReference: "fixture:reviewer:approved", evidenceEvaluationId: "fixture-evaluation-generic-01", policyDigest: policy.digest, categoryMetadataDigest: DIGEST_A, selectedVariantId: "A" },
  };
}

export function genericCommerceFields(): RegistrationCommerceFields {
  return { liveWriteApproval: { approved: true, approvalReference: "fixture:approval:synthetic-only" }, vendorUserId: "fixture-user", displayCategoryCode: 77701, saleStartedAt: "2026-08-13T00:00:00.000Z", saleEndedAt: "2099-12-31T00:00:00.000Z", deliveryMethod: "SEQUENCIAL", deliveryChargeType: "FREE", outboundShippingPlaceCode: "fixture-outbound", returnCenterCode: "fixture-return", companyContactNumber: "fixture-contact", returnZipCode: "00000", returnAddress: "fixture-address", returnAddressDetail: "fixture-detail", originalPrice: 12000, salePrice: 9900, maximumBuyCount: 10, stockQuantity: 3, attributes: [], options: [], searchFilters: [{ name: "색상", value: "네이비", factIds: ["fixture-fact-3"] }], notices: [{ name: "품명 및 모델명", value: "정리 파우치 GL-01", factIds: ["fixture-fact-1", "fixture-fact-2"] }] };
}
