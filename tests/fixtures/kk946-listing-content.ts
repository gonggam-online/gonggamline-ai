import type { ListingContentInput, RegistrationCommerceFields } from "../../shared/domain/listing-content.ts";
import { LISTING_EVIDENCE_SCHEMA_VERSION, type ListingEvidenceFact } from "../../shared/domain/listing-evidence.ts";
import { findApprovedSupplierTrustProfile } from "../../engines/listing/approved-supplier-profiles.ts";
import { admitTrustedSupplierObservations } from "../../engines/listing/supplier-trust.ts";
import { genericCategorySnapshot, genericListingInput } from "./listing-content.ts";

const DIGEST = "d".repeat(64);

function catalog(field: string, value: string | number, index: number): ListingEvidenceFact {
  return { factId: `kk946-catalog-${index}`, subjectId: "KK946", field, factClass: "CATALOG_CLAIM", value, sourceType: "SUPPLIER_CATALOG", sourceReference: "evidence:kk946:sanitized-catalog", evidenceDigest: DIGEST, observedAt: "2026-08-12T00:00:00.000Z", capturedAt: "2026-08-12T00:00:01.000Z", status: "PROVEN", scope: "CATALOG_ITEM", scopeReference: "catalog-item:kk946" };
}

function physical(field: string, value: string | number, index: number): ListingEvidenceFact {
  return { ...catalog(field, value, index), factId: `kk946-inspection-${index}`, factClass: "PHYSICAL_OBSERVATION", sourceType: "THREE_PL_INSPECTION", sourceReference: "evidence:kk946:sanitized-inspection", scope: "INBOUND_LOT", scopeReference: "inbound-lot:kk946-six-units" };
}

function admittedDomeggookFacts(): readonly ListingEvidenceFact[] {
  const profile = findApprovedSupplierTrustProfile("domeggook");
  if (!profile) throw new Error("Domeggook trust profile fixture is unavailable");
  const entries = [["productName", "미니 파우치"], ["modelName", "KK946"], ["material", "폴리에스터"], ["manufacturer", "KLAND"], ["origin", "중국 OEM"]] as const;
  return admitTrustedSupplierObservations(profile, entries.map(([field, value], index) => ({ observationId: `kk946-${index + 1}`, subjectId: "KK946", field, value, sourceId: "domeggook", sourceReference: "evidence:kk946:sanitized-catalog", evidenceDigest: DIGEST, observedAt: "2026-08-12T00:00:00.000Z", capturedAt: "2026-08-12T00:00:01.000Z" })), "2026-08-13T00:00:00.000Z").facts;
}

export function kk946AcceptanceInput(): ListingContentInput {
  const domeggookProfile = findApprovedSupplierTrustProfile("domeggook");
  if (!domeggookProfile) throw new Error("Domeggook trust profile fixture is unavailable");
  const facts: ListingEvidenceFact[] = [
    ...admittedDomeggookFacts(), physical("color", "블랙", 3), physical("dimensions", "10.5 × 3.6 × 6.5 cm", 5), physical("stockQuantity", 6, 8),
    { ...catalog("imageUseRights", "VERIFIED", 9), factId: "kk946-image-use", factClass: "IMAGE_USE_RIGHT", sourceType: "RIGHTS_GRANT", scope: "ASSET", scopeReference: "asset:kk946-supplier-original" },
    { ...catalog("imageEditRights", "UNKNOWN", 10), factId: "kk946-image-edit", factClass: "IMAGE_EDIT_RIGHT", sourceType: "RIGHTS_GRANT", scope: "ASSET", scopeReference: "asset:kk946-supplier-original", status: "UNKNOWN" },
  ];
  const generic = genericListingInput();
  return {
    ...generic,
    packetId: "acceptance-packet-kk946-v1", subjectId: "KK946",
    evidence: { schemaVersion: LISTING_EVIDENCE_SCHEMA_VERSION, subjectId: "KK946", evaluationId: "acceptance-evaluation-kk946-v1", evaluatedAt: "2026-08-13T00:00:00.000Z", facts, requiredFields: ["productName", "modelName", "color", "material", "dimensions", "manufacturer", "origin", "stockQuantity", "imageUseRights", "imageEditRights", "coupangCategoryContract", "productNoticeFacts"] },
    category: { ...genericCategorySnapshot, displayCategoryCode: "0", categoryValid: false, selectedNoticeCategoryName: null, disposition: "QUARANTINED", issues: [{ code: "INVALID_CATEGORY_CODE", path: "displayCategoryCode" }] },
    supplierTrust: { profileId: domeggookProfile.profileId, sourceId: domeggookProfile.sourceId, version: domeggookProfile.version, capabilityDigest: domeggookProfile.capabilityDigest, status: domeggookProfile.status },
    titleFieldOrder: ["productName", "modelName", "color", "material"], minimumRequiredFields: ["productName", "modelName", "color", "coupangCategoryContract", "productNoticeFacts"], corePurchaseFields: ["modelName", "color", "stockQuantity"], keywordFields: ["productName", "modelName", "color"], customerIntents: [{ intentId: "portable-small-storage", query: "휴대용 소형 수납", attributeFields: ["productName", "dimensions", "color"] }, { intentId: "verify-pouch-size", query: "파우치 크기", attributeFields: ["dimensions"] }],
    queryAttributeMappings: [{ query: "휴대용 소형 수납", taxonomy: "USE_CASE", field: "productName", priority: 3, sourceIds: ["coupang-marketplace-search-guide"] }, { query: "파우치 크기", taxonomy: "FIT", field: "dimensions", priority: 3, sourceIds: ["baymard-product-image-text-research"] }],
    marketObservations: [],
    detailClaims: [{ blockType: "IDENTITY", heading: "상품", field: "productName", priority: 10 }, { blockType: "SPECIFICATION", heading: "소재", field: "material", priority: 9 }, { blockType: "SPECIFICATION", heading: "크기", field: "dimensions", priority: 10 }, { blockType: "NOTICE", heading: "제조자", field: "manufacturer", priority: 8 }, { blockType: "NOTICE", heading: "제조국", field: "origin", priority: 8 }],
    ownerApprovedFallbacks: [],
    sourceAssets: [{ assetId: "kk946-supplier-original", digest: DIGEST, width: 1000, height: 1000, byteSize: 50000, mimeType: "image/jpeg", sourceReference: "evidence:kk946:supplier-asset-private", provenanceFactIds: ["kk946-image-use", "kk946-image-edit"], creatorReference: "evidence:unknown-creator", rightsHolderReference: "evidence:verified-use-grantor", useRights: "VERIFIED", editRights: "UNKNOWN", permittedChannels: ["COUPANG"], permittedTransformations: ["NONE"], productAccuracyStatus: "VERIFIED", altText: "블랙 미니 파우치 공급사 원본" }],
    assetRequests: [
      { sourceAssetId: "kk946-supplier-original", outputAssetId: "kk946-original-main", outputReference: "evidence:kk946:supplier-asset-private", transformationReference: "NONE", outputRightsReference: "evidence:verified-use-grantor", providerApprovalReference: null, role: "MAIN", shotType: "PACKSHOT", transformation: "NONE", outputDigest: DIGEST, width: 1000, height: 1000, byteSize: 50000, mimeType: "image/jpeg", altText: "블랙 미니 파우치 대표 이미지", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
      { sourceAssetId: "kk946-supplier-original", outputAssetId: "kk946-derived-additional", outputReference: "fixture:unavailable:kk946-derived-additional", transformationReference: "fixture:unavailable", outputRightsReference: "fixture:unavailable", providerApprovalReference: null, role: "ADDITIONAL", shotType: "ANGLE", transformation: "CROP", outputDigest: DIGEST, width: 1000, height: 1000, byteSize: 50000, mimeType: "image/jpeg", altText: "블랙 미니 파우치 추가 이미지", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
    ],
    contentApproval: { decision: "APPROVED_FOR_PAYLOAD_MAPPING", reviewerReference: "acceptance:owner-scope", evidenceEvaluationId: "acceptance-evaluation-kk946-v1", policyDigest: generic.policy.digest, categoryMetadataDigest: genericCategorySnapshot.metadataDigest, selectedVariantId: "A" },
  };
}

export const kk946CommerceFields: RegistrationCommerceFields = {
  liveWriteApproval: { approved: false, approvalReference: "" }, vendorUserId: "evidence:private-wing-user", displayCategoryCode: 0, saleStartedAt: "2026-08-13T00:00:00.000Z", saleEndedAt: "2099-12-31T00:00:00.000Z", deliveryMethod: "SEQUENCIAL", deliveryChargeType: "FREE", outboundShippingPlaceCode: "evidence:private-outbound", returnCenterCode: "evidence:private-return", companyContactNumber: "evidence:private-contact", returnZipCode: "evidence:private-zip", returnAddress: "evidence:private-return-address", returnAddressDetail: "evidence:private-return-detail", originalPrice: 4290, salePrice: 4290, maximumBuyCount: 6, stockQuantity: 6, attributes: [], options: [], searchFilters: [{ name: "색상", value: "블랙", factIds: ["kk946-inspection-3"] }], notices: [{ name: "품명 및 모델명", value: "미니 파우치 KK946", factIds: ["trusted:domeggook-approved-catalog:kk946-1", "trusted:domeggook-approved-catalog:kk946-2"] }],
};
