import type { ListingContentInput, RegistrationCommerceFields } from "../../shared/domain/listing-content.ts";
import { LISTING_EVIDENCE_SCHEMA_VERSION, type ListingEvidenceFact } from "../../shared/domain/listing-evidence.ts";
import { genericCategorySnapshot, genericListingInput } from "./listing-content.ts";

const DIGEST = "d".repeat(64);

function catalog(field: string, value: string | number, index: number): ListingEvidenceFact {
  return { factId: `kk946-catalog-${index}`, subjectId: "KK946", field, factClass: "CATALOG_CLAIM", value, sourceType: "SUPPLIER_CATALOG", sourceReference: "evidence:kk946:sanitized-catalog", evidenceDigest: DIGEST, observedAt: "2026-08-12T00:00:00.000Z", capturedAt: "2026-08-12T00:00:01.000Z", status: "PROVEN", scope: "CATALOG_ITEM", scopeReference: "catalog-item:kk946" };
}

function physical(field: string, value: string | number, index: number): ListingEvidenceFact {
  return { ...catalog(field, value, index), factId: `kk946-inspection-${index}`, factClass: "PHYSICAL_OBSERVATION", sourceType: "THREE_PL_INSPECTION", sourceReference: "evidence:kk946:sanitized-inspection", scope: "INBOUND_LOT", scopeReference: "inbound-lot:kk946-six-units" };
}

export function kk946AcceptanceInput(): ListingContentInput {
  const facts: ListingEvidenceFact[] = [
    catalog("productName", "미니 파우치", 1), catalog("modelName", "KK946", 2), physical("color", "블랙", 3),
    catalog("material", "폴리에스터", 4), physical("dimensions", "10.5 × 3.6 × 6.5 cm", 5), catalog("manufacturer", "KLAND", 6),
    catalog("origin", "중국 OEM", 7), physical("stockQuantity", 6, 8),
    { ...catalog("imageUseRights", "VERIFIED", 9), factId: "kk946-image-use", factClass: "IMAGE_USE_RIGHT", sourceType: "RIGHTS_GRANT", scope: "ASSET", scopeReference: "asset:kk946-supplier-original" },
    { ...catalog("imageEditRights", "UNKNOWN", 10), factId: "kk946-image-edit", factClass: "IMAGE_EDIT_RIGHT", sourceType: "RIGHTS_GRANT", scope: "ASSET", scopeReference: "asset:kk946-supplier-original", status: "UNKNOWN" },
  ];
  const generic = genericListingInput();
  return {
    ...generic,
    packetId: "acceptance-packet-kk946-v1", subjectId: "KK946",
    evidence: { schemaVersion: LISTING_EVIDENCE_SCHEMA_VERSION, subjectId: "KK946", evaluationId: "acceptance-evaluation-kk946-v1", evaluatedAt: "2026-08-13T00:00:00.000Z", facts, requiredFields: ["productName", "modelName", "color", "material", "dimensions", "manufacturer", "origin", "stockQuantity", "imageUseRights", "imageEditRights", "coupangCategoryContract", "productNoticeFacts"] },
    category: { ...genericCategorySnapshot, displayCategoryCode: "0", categoryValid: false, selectedNoticeCategoryName: null, disposition: "QUARANTINED", issues: [{ code: "INVALID_CATEGORY_CODE", path: "displayCategoryCode" }] },
    titleFieldOrder: ["productName", "modelName", "color", "material"], minimumRequiredFields: ["productName", "modelName", "color", "coupangCategoryContract", "productNoticeFacts"], corePurchaseFields: ["modelName", "color", "stockQuantity"], keywordFields: ["productName", "modelName", "color"], customerIntents: [{ intentId: "portable-small-storage", query: "휴대용 소형 수납", attributeFields: ["productName", "dimensions", "color"] }],
    detailClaims: [{ heading: "소재", field: "material" }, { heading: "크기", field: "dimensions" }, { heading: "제조자", field: "manufacturer" }, { heading: "제조국", field: "origin" }],
    sourceAssets: [{ assetId: "kk946-supplier-original", digest: DIGEST, width: 1000, height: 1000, byteSize: 50000, mimeType: "image/jpeg", sourceReference: "evidence:kk946:supplier-asset-private", provenanceFactIds: ["kk946-image-use", "kk946-image-edit"], creatorReference: "evidence:unknown-creator", rightsHolderReference: "evidence:verified-use-grantor", useRights: "VERIFIED", editRights: "UNKNOWN", permittedChannels: ["COUPANG"], permittedTransformations: ["NONE"], productAccuracyStatus: "VERIFIED", altText: "블랙 미니 파우치 공급사 원본" }],
    assetRequests: [
      { sourceAssetId: "kk946-supplier-original", outputAssetId: "kk946-original-main", role: "MAIN", transformation: "NONE", outputDigest: DIGEST, width: 1000, height: 1000, byteSize: 50000, mimeType: "image/jpeg", altText: "블랙 미니 파우치 대표 이미지" },
      { sourceAssetId: "kk946-supplier-original", outputAssetId: "kk946-derived-additional", role: "ADDITIONAL", transformation: "CROP", outputDigest: DIGEST, width: 1000, height: 1000, byteSize: 50000, mimeType: "image/jpeg", altText: "블랙 미니 파우치 추가 이미지" },
    ],
    contentApproval: { decision: "APPROVED_FOR_PAYLOAD_MAPPING", reviewerReference: "acceptance:owner-scope", evidenceEvaluationId: "acceptance-evaluation-kk946-v1", policyDigest: generic.policy.digest, categoryMetadataDigest: genericCategorySnapshot.metadataDigest },
  };
}

export const kk946CommerceFields: RegistrationCommerceFields = {
  liveWriteApproval: { approved: false, approvalReference: "" }, vendorUserId: "evidence:private-wing-user", displayCategoryCode: 0, saleStartedAt: "2026-08-13T00:00:00.000Z", saleEndedAt: "2099-12-31T00:00:00.000Z", deliveryMethod: "SEQUENCIAL", deliveryChargeType: "FREE", outboundShippingPlaceCode: "evidence:private-outbound", returnCenterCode: "evidence:private-return", companyContactNumber: "evidence:private-contact", returnZipCode: "evidence:private-zip", returnAddress: "evidence:private-return-address", returnAddressDetail: "evidence:private-return-detail", originalPrice: 4290, salePrice: 4290, maximumBuyCount: 6, stockQuantity: 6, attributes: [{ name: "색상", value: "블랙", factIds: ["kk946-inspection-3"] }], notices: [{ name: "품명 및 모델명", value: "미니 파우치 KK946", factIds: ["kk946-catalog-1", "kk946-catalog-2"] }],
};
