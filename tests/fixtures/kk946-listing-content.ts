import type { CoupangCategorySnapshot } from "../../shared/contracts/coupang-category-snapshot.ts";
import type { ListingContentInput, RegistrationCommerceFields } from "../../shared/domain/listing-content.ts";
import { LISTING_EVIDENCE_SCHEMA_VERSION, type ListingEvidenceFact } from "../../shared/domain/listing-evidence.ts";
import { findApprovedSupplierTrustProfile } from "../../engines/listing/approved-supplier-profiles.ts";
import { digestCanonicalJson } from "../../engines/listing/category-snapshot.ts";
import { admitTrustedSupplierObservations } from "../../engines/listing/supplier-trust.ts";
import { genericCategorySnapshot, genericListingInput } from "./listing-content.ts";

const DIGEST = "d".repeat(64);

function catalog(field: string, value: string | number | boolean, index: number): ListingEvidenceFact {
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

const WING_OBSERVED_AT = "2026-08-14T03:00:00.000Z";
const MAIN_ASSET_DIGEST = "d3ab260cef16fd5fc0485591b01fe0571d3d5f04b61832159b5029a2c4797bcf";
const DETAIL_ASSET_DIGEST = "24c70d1f4b124093baa73c5e84210d1c209234e9e569a9756ac33f72de3f1449";
const MAIN_ASSET_URL = "https://cdn1.domeggook.com/upload/item/2025/04/04/174375410405D99521FE1642D2F86834/174375410405D99521FE1642D2F86834_img_760?hash=fbbababcf3996b5a0feeeb9dc3556409";
const DETAIL_ASSET_URL = "https://images002.sabangnet.co.kr/v1/AUTH_63599845f0db471682fd9b55ff0c7ce9/image/1773042545001.jpg";

export const kk946WingCategoryMetadataObservation = Object.freeze({
  source: "authenticated WING product form",
  displayCategoryCode: "69291",
  internalCategoryId: "2979",
  fullPath: ["패션의류잡화", "여성패션", "여성잡화", "가방", "여성파우치"],
  commissionRatePercentExcludingVat: 10.5,
  noticeCategoryName: "가방",
  searchFilterNames: [
    "출시 연도", "출시 계절", "패션 의류/잡화 색상계열", "패션 잡화 소재", "패턴/프린트",
    "패션잡화 사이즈", "제조년도", "파우치 종류", "손잡이 유무", "구성", "사용대상 구분",
    "수량", "스타일", "잠금/고정방식", "주머니 수", "칸/분할 수", "모델명/품번",
    "Manufacturer Part Number", "Parent Manufacturer Part Number", "Global Trade Item Number",
  ],
  requiredNoticeFields: ["종류", "소재", "색상", "크기", "제조자(수입자)", "제조국", "취급시 주의사항", "품질보증기준", "A/S 책임자와 전화번호"],
  observedAt: WING_OBSERVED_AT,
});

const kk946WingCategoryMetadataDigest = digestCanonicalJson(kk946WingCategoryMetadataObservation) ?? "";
const kk946WingCategoryValidityDigest = digestCanonicalJson({
  displayCategoryCode: "69291",
  categoryValid: true,
  evidence: "WING loaded category-specific options, notices, filters, shipping, return, and enabled product registration validation",
  observedAt: WING_OBSERVED_AT,
}) ?? "";

function categoryAttribute(
  attributeTypeName: string,
  groupNumber: string,
  inputType: "INPUT" | "SELECT",
  inputValues: readonly string[] = [],
): CoupangCategorySnapshot["attributes"][number] {
  return { attributeTypeName, required: "OPTIONAL", dataType: "STRING", basicUnit: "없음", inputType, inputValues, usableUnits: [], groupNumber, exposed: "EXPOSED" };
}

export const kk946WingCategorySnapshot: CoupangCategorySnapshot = Object.freeze({
  schemaVersion: "gonggamline-coupang-category-snapshot-v1",
  rulesetVersion: "gonggamline-coupang-category-snapshot-rules-v1",
  displayCategoryCode: "69291",
  channel: "MARKETPLACE",
  observedAt: WING_OBSERVED_AT,
  metadataDigest: kk946WingCategoryMetadataDigest,
  validityDigest: kk946WingCategoryValidityDigest,
  categoryValid: true,
  isAllowSingleItem: true,
  attributes: Object.freeze([
    categoryAttribute("출시 연도", "1", "INPUT"),
    categoryAttribute("출시 계절", "2", "SELECT"),
    categoryAttribute("패션 의류/잡화 색상계열", "3", "SELECT", ["블랙계열"]),
    categoryAttribute("패션 잡화 소재", "4", "SELECT", ["폴리에스터"]),
    categoryAttribute("패턴/프린트", "5", "SELECT"),
    categoryAttribute("패션잡화 사이즈", "6", "SELECT", ["FREE"]),
    categoryAttribute("제조년도", "7", "SELECT"),
    categoryAttribute("파우치 종류", "8", "SELECT", ["일반/다용도"]),
    categoryAttribute("손잡이 유무", "9", "SELECT"),
    categoryAttribute("구성", "10", "SELECT", ["단품"]),
    categoryAttribute("사용대상 구분", "11", "SELECT"),
    categoryAttribute("수량", "12", "INPUT"),
    categoryAttribute("스타일", "13", "SELECT", ["키체인 후크"]),
    categoryAttribute("잠금/고정방식", "14", "SELECT", ["지퍼형"]),
    categoryAttribute("주머니 수", "15", "INPUT"),
    categoryAttribute("칸/분할 수", "16", "INPUT"),
    categoryAttribute("모델명/품번", "17", "INPUT"),
    categoryAttribute("Manufacturer Part Number", "18", "INPUT"),
    categoryAttribute("Parent Manufacturer Part Number", "19", "INPUT"),
    categoryAttribute("Global Trade Item Number", "20", "INPUT"),
  ]),
  noticeCategories: Object.freeze([{
    noticeCategoryName: "가방",
    detailNames: Object.freeze(kk946WingCategoryMetadataObservation.requiredNoticeFields.map((noticeCategoryDetailName) => ({ noticeCategoryDetailName, required: "MANDATORY" as const }))),
  }]),
  requiredDocuments: Object.freeze([]),
  certifications: Object.freeze([]),
  allowedOfferConditions: Object.freeze(["NEW"]),
  selectedNoticeCategoryName: "가방",
  disposition: "VALIDATED",
  issues: Object.freeze([]),
});

export type Kk946PrivateWingFields = Readonly<{
  vendorUserId: string;
  outboundShippingPlaceCode: string;
  returnCenterCode: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
}>;

function documentaryFact(field: string, value: string | number, index: number, sourceReference: string): ListingEvidenceFact {
  return {
    ...catalog(field, value, index),
    factId: `kk946-wing-document-${index}`,
    factClass: "DOCUMENTARY_FACT",
    sourceType: "COMPETENT_DOCUMENT",
    sourceReference,
    reviewerReference: "owner:kk946-wing-adapter:2026-08-14",
  };
}

function categoryFact(field: string, value: string, index: number): ListingEvidenceFact {
  return {
    ...catalog(field, value, index),
    factId: `kk946-wing-category-${index}`,
    factClass: "COUPANG_CATEGORY_REQUIREMENT",
    sourceType: "COUPANG_CATEGORY_METADATA",
    sourceReference: "https://wing.coupang.com/tenants/seller-web/vendor-inventory/formV2#displayCategoryCode=69291",
    evidenceDigest: kk946WingCategoryMetadataDigest,
    reviewerReference: "authenticated-wing-observation:2026-08-14",
  };
}

function transactionFact(field: string, value: string | number | boolean, index: number): ListingEvidenceFact {
  return {
    ...catalog(field, value, index),
    factId: `kk946-wing-transaction-${index}`,
    factClass: "TRANSACTION_TERM",
    sourceType: "TRANSACTION",
    sourceReference: "evidence:kk946:six-unit-approved-commerce-terms",
    scope: "PURCHASED_SKU",
    scopeReference: "purchased-sku:kk946-black-six-units",
    reviewerReference: "owner:kk946-six-unit-terms",
  };
}

export function kk946WingRegistrationAdapter(privateFields: Kk946PrivateWingFields): Readonly<{
  input: ListingContentInput;
  commerce: RegistrationCommerceFields;
}> {
  const base = kk946AcceptanceInput();
  const retainedFacts = base.evidence.facts.filter(({ field }) => field !== "material");
  const facts: ListingEvidenceFact[] = [
    ...retainedFacts,
    documentaryFact("material", "PVC, 폴리에스터", 20, "evidence:kk946:supplier-notice-and-unchanged-detail-reconciliation"),
    documentaryFact("useCase", "충전기 케이블 수납", 21, "evidence:kk946:supplier-title-and-unchanged-detail"),
    documentaryFact("keyword1", "충전기 파우치", 22, "evidence:kk946:query-attribute-mapping"),
    documentaryFact("keyword2", "케이블 파우치", 23, "evidence:kk946:query-attribute-mapping"),
    documentaryFact("keyword3", "소형 수납 파우치", 24, "evidence:kk946:query-attribute-mapping"),
    documentaryFact("keyword4", "투명 파우치", 25, "evidence:kk946:visible-product-attribute"),
    documentaryFact("size", "FREE", 26, "evidence:kk946:wing-purchase-option"),
    documentaryFact("quantity", 1, 27, "evidence:kk946:single-unit-offer"),
    documentaryFact("closure", "지퍼형", 28, "evidence:kk946:unchanged-product-visual"),
    documentaryFact("careNotice", "생산 시기에 따라 색상 차이가 있을 수 있으며, 배송 중 구김·제작 과정의 미세 스크래치와 자국이 발생할 수 있습니다.", 29, "evidence:kk946:supplier-detail-notice"),
    documentaryFact("qualityWarranty", "제품 이상 시 공정거래위원회 고시 소비자분쟁해결기준에 의거 보상합니다.", 30, "evidence:kk946:wing-notice-policy-example"),
    documentaryFact("asContact", `공감라인 고객센터 / ${privateFields.companyContactNumber}`, 31, "evidence:kk946:wing-registered-contact"),
    documentaryFact("productNoticeFacts", "가방 고시 필수 9개 필드 검증", 32, "evidence:kk946:wing-notice-form"),
    categoryFact("coupangCategoryContract", "displayCategoryCode=69291; internalCategoryId=2979; 가방 고시", 33),
    transactionFact("shippingSummary", "무료배송, 당일출고", 34),
    transactionFact("returnSummary", "고객 사유 반품 시 왕복 배송비 6,000원", 35),
    transactionFact("advertisingEnabled", false, 36),
    transactionFact("reorderEnabled", false, 37),
    documentaryFact("style", "키체인 후크", 38, "evidence:kk946:unchanged-product-visual"),
  ];
  const factIds = (field: string): string[] => facts.filter((fact) => fact.field === field && fact.status === "PROVEN").map(({ factId }) => factId);
  const manufacturerFactIds = factIds("manufacturer");
  const input: ListingContentInput = {
    ...base,
    packetId: "kk946-wing-registration-packet-v1",
    evidence: {
      ...base.evidence,
      evaluationId: "kk946-wing-evaluation-2026-08-14-v1",
      evaluatedAt: WING_OBSERVED_AT,
      facts,
      requiredFields: ["productName", "modelName", "color", "material", "dimensions", "manufacturer", "origin", "stockQuantity", "quantity", "imageUseRights", "imageEditRights", "coupangCategoryContract", "productNoticeFacts", "manufacturerImporter"],
    },
    category: kk946WingCategorySnapshot,
    titleFieldOrder: ["productName", "useCase", "modelName"],
    minimumRequiredFields: ["productName", "modelName", "color", "material", "dimensions", "manufacturer", "origin", "stockQuantity", "quantity", "coupangCategoryContract", "productNoticeFacts", "manufacturerImporter"],
    corePurchaseFields: ["modelName", "color", "material", "stockQuantity", "quantity"],
    keywordFields: ["keyword1", "keyword2", "keyword3", "keyword4", "productName", "useCase", "modelName"],
    customerIntents: [
      { intentId: "organize-charging-accessories", query: "충전기 케이블 수납", attributeFields: ["productName", "useCase", "dimensions"] },
      { intentId: "verify-portable-size", query: "미니 파우치 크기", attributeFields: ["dimensions", "quantity"] },
    ],
    queryAttributeMappings: [
      { query: "충전기 케이블 수납", taxonomy: "USE_CASE", field: "useCase", priority: 4, sourceIds: ["coupang-marketplace-search-guide"] },
      { query: "충전기 케이블 수납", taxonomy: "DISCOVERY", field: "productName", priority: 3, sourceIds: ["google-merchant-title-guide"] },
      { query: "미니 파우치 크기", taxonomy: "FIT", field: "dimensions", priority: 4, sourceIds: ["baymard-product-image-text-research"] },
    ],
    marketObservations: [],
    detailClaims: [
      { blockType: "IDENTITY", heading: "상품", field: "productName", priority: 10 },
      { blockType: "VERIFIED_BENEFIT", heading: "수납 용도", field: "useCase", priority: 9 },
      { blockType: "SPECIFICATION", heading: "실제 크기", field: "dimensions", priority: 10 },
      { blockType: "SPECIFICATION", heading: "색상", field: "color", priority: 9 },
      { blockType: "SPECIFICATION", heading: "소재", field: "material", priority: 9 },
      { blockType: "SPECIFICATION", heading: "구성", field: "quantity", priority: 8 },
      { blockType: "OBJECTION", heading: "구매 전 확인", field: "careNotice", priority: 8 },
      { blockType: "FULFILLMENT", heading: "배송", field: "shippingSummary", priority: 7 },
      { blockType: "NOTICE", heading: "제조자·수입자", field: "manufacturerImporter", priority: 7 },
      { blockType: "NOTICE", heading: "제조국", field: "origin", priority: 7 },
    ],
    ownerApprovedFallbacks: [{
      targetField: "manufacturerImporter",
      value: "KLAND / KLAND",
      assumption: "승인 공급처가 제조자 단일 필드만 제공하고 별도 수입자 상호가 확인되지 않아 owner-approved 운영 fallback을 적용",
      approvalReference: "owner-decision:approved-supplier-importer-fallback:2026-08-14",
      provenanceFactIds: manufacturerFactIds,
      categoryAllowsFallback: true,
    }],
    sourceAssets: [
      { assetId: "kk946-supplier-main-unchanged", digest: MAIN_ASSET_DIGEST, width: 760, height: 760, byteSize: 126675, mimeType: "image/jpeg", sourceReference: MAIN_ASSET_URL, provenanceFactIds: ["kk946-image-use", "kk946-image-edit", ...factIds("color")], creatorReference: "supplier-catalog:56288849", rightsHolderReference: "domeggook:detail-image-use-allowed", useRights: "VERIFIED", editRights: "UNKNOWN", permittedChannels: ["COUPANG"], permittedTransformations: ["NONE"], productAccuracyStatus: "VERIFIED", altText: "블랙 색상을 포함한 미니 충전기 수납 파우치 공급사 원본" },
      { assetId: "kk946-supplier-detail-unchanged", digest: DETAIL_ASSET_DIGEST, width: 860, height: 10877, byteSize: 2882348, mimeType: "image/jpeg", sourceReference: DETAIL_ASSET_URL, provenanceFactIds: ["kk946-image-use", "kk946-image-edit", ...factIds("material")], creatorReference: "supplier-catalog:56288849", rightsHolderReference: "domeggook:detail-image-use-allowed", useRights: "VERIFIED", editRights: "UNKNOWN", permittedChannels: ["COUPANG"], permittedTransformations: ["NONE"], productAccuracyStatus: "CONFLICT", altText: "화이트와 블랙 색상 예시를 함께 포함한 공급사 상세 원본" },
    ],
    assetRequests: [
      { sourceAssetId: "kk946-supplier-main-unchanged", outputAssetId: "kk946-main-unchanged-v1", outputReference: MAIN_ASSET_URL, transformationReference: "NONE", outputRightsReference: "domeggook:detail-image-use-allowed", providerApprovalReference: null, role: "MAIN", shotType: "PACKSHOT", transformation: "NONE", outputDigest: MAIN_ASSET_DIGEST, width: 760, height: 760, byteSize: 126675, mimeType: "image/jpeg", altText: "블랙 색상을 포함한 미니 충전기 수납 파우치", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
      { sourceAssetId: "kk946-supplier-detail-unchanged", outputAssetId: "kk946-detail-source-excluded-v1", outputReference: DETAIL_ASSET_URL, transformationReference: "NONE", outputRightsReference: "domeggook:detail-image-use-allowed", providerApprovalReference: null, role: "DETAIL", shotType: "DETAIL", transformation: "NONE", outputDigest: DETAIL_ASSET_DIGEST, width: 860, height: 10877, byteSize: 2882348, mimeType: "image/jpeg", altText: "화이트와 블랙 색상 예시를 함께 포함한 공급사 상세 원본", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
      { sourceAssetId: "kk946-supplier-main-unchanged", outputAssetId: "kk946-derived-unavailable-v1", outputReference: "evidence:kk946:derivative-unavailable", transformationReference: "evidence:kk946:edit-rights-unknown", outputRightsReference: "evidence:kk946:edit-rights-unknown", providerApprovalReference: null, role: "ADDITIONAL", shotType: "ANGLE", transformation: "CROP", outputDigest: MAIN_ASSET_DIGEST, width: 760, height: 760, byteSize: 126675, mimeType: "image/jpeg", altText: "편집권 미확인으로 생성하지 않은 추가 이미지", renderedReview: { load: "PASS", crop: "PASS", background: "PASS", promotionalText: "PASS" } },
    ],
    contentApproval: {
      decision: "APPROVED_FOR_PAYLOAD_MAPPING",
      reviewerReference: "owner:kk946-content-approval:2026-08-14",
      evidenceEvaluationId: "kk946-wing-evaluation-2026-08-14-v1",
      policyDigest: base.policy.digest,
      categoryMetadataDigest: kk946WingCategoryMetadataDigest,
      selectedVariantId: "A",
    },
  };
  const commerce: RegistrationCommerceFields = {
    liveWriteApproval: { approved: true, approvalReference: "owner:kk946-live-write-approval:2026-08-14" },
    vendorUserId: privateFields.vendorUserId,
    displayCategoryCode: 69291,
    saleStartedAt: "2026-08-13T15:00:00.000Z",
    saleEndedAt: "2099-12-31T14:59:59.000Z",
    deliveryMethod: "SEQUENCIAL",
    deliveryChargeType: "FREE",
    outboundShippingPlaceCode: privateFields.outboundShippingPlaceCode,
    returnCenterCode: privateFields.returnCenterCode,
    companyContactNumber: privateFields.companyContactNumber,
    returnZipCode: privateFields.returnZipCode,
    returnAddress: privateFields.returnAddress,
    returnAddressDetail: privateFields.returnAddressDetail,
    originalPrice: 4290,
    salePrice: 4290,
    maximumBuyCount: 6,
    stockQuantity: 6,
    notices: [
      { name: "종류", value: "미니 수납 파우치", factIds: factIds("productName") },
      { name: "소재", value: "PVC, 폴리에스터", factIds: factIds("material") },
      { name: "색상", value: "블랙", factIds: factIds("color") },
      { name: "크기", value: "10.5 x 3.6 x 6.5 cm", factIds: factIds("dimensions") },
      { name: "제조자(수입자)", value: "KLAND / KLAND", factIds: manufacturerFactIds },
      { name: "제조국", value: "중국(OEM)", factIds: factIds("origin") },
      { name: "취급시 주의사항", value: String(facts.find(({ field }) => field === "careNotice")?.value ?? ""), factIds: factIds("careNotice") },
      { name: "품질보증기준", value: String(facts.find(({ field }) => field === "qualityWarranty")?.value ?? ""), factIds: factIds("qualityWarranty") },
      { name: "A/S 책임자와 전화번호", value: `공감라인 고객센터 / ${privateFields.companyContactNumber}`, factIds: factIds("asContact") },
    ],
    attributes: [],
    options: [
      { name: "색상", value: "블랙", factIds: factIds("color") },
      { name: "패션의류/잡화 사이즈", value: "FREE", factIds: factIds("size") },
    ],
    searchFilters: [
      { name: "패션 의류/잡화 색상계열", value: "블랙계열", factIds: factIds("color") },
      { name: "패션 잡화 소재", value: "폴리에스터", factIds: factIds("material") },
      { name: "패션잡화 사이즈", value: "FREE", factIds: factIds("size") },
      { name: "파우치 종류", value: "일반/다용도", factIds: factIds("productName") },
      { name: "구성", value: "단품", factIds: factIds("quantity") },
      { name: "수량", value: "1", factIds: factIds("quantity") },
      { name: "스타일", value: "키체인 후크", factIds: factIds("style") },
      { name: "잠금/고정방식", value: "지퍼형", factIds: factIds("closure") },
      { name: "주머니 수", value: "1", factIds: factIds("quantity") },
      { name: "칸/분할 수", value: "1", factIds: factIds("quantity") },
      { name: "모델명/품번", value: "KK946", factIds: factIds("modelName") },
    ],
  };
  return Object.freeze({ input: Object.freeze(input), commerce: Object.freeze(commerce) });
}
