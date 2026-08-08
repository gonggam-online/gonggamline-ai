import assert from "node:assert/strict";
import test from "node:test";

import { preflightMarketplaceProductCreation } from "../engines/listing/coupang-product-preflight.ts";
import {
  COUPANG_PRODUCT_INTENT_SCHEMA_VERSION,
  type MarketplacePreflightEvidence,
  type MarketplaceProductCreationIntent,
} from "../shared/contracts/coupang-product-preflight.ts";
import type { CoupangCategorySnapshot } from "../shared/contracts/coupang-category-snapshot.ts";

const categorySnapshot: CoupangCategorySnapshot = {
  schemaVersion: "gonggamline-coupang-category-snapshot-v1",
  rulesetVersion: "gonggamline-coupang-category-snapshot-rules-v1",
  displayCategoryCode: "78877",
  channel: "MARKETPLACE",
  observedAt: "2026-08-08T00:00:00.000Z",
  metadataDigest: "a".repeat(64),
  validityDigest: "b".repeat(64),
  categoryValid: true,
  isAllowSingleItem: true,
  attributes: [{
    attributeTypeName: "색상",
    required: "MANDATORY",
    dataType: "STRING",
    basicUnit: "없음",
    inputType: "INPUT",
    inputValues: [],
    usableUnits: [],
    groupNumber: "1",
    exposed: "EXPOSED",
  }],
  noticeCategories: [{
    noticeCategoryName: "기타 재화",
    detailNames: [{ noticeCategoryDetailName: "품명 및 모델명", required: "MANDATORY" }],
  }],
  requiredDocuments: [],
  certifications: [{
    certificationType: "NOT_REQUIRED",
    name: "인증 대상 아님",
    dataType: "NONE",
    required: "OPTIONAL",
  }],
  allowedOfferConditions: ["NEW"],
  selectedNoticeCategoryName: "기타 재화",
  disposition: "VALIDATED",
  issues: [],
};

function intent(overrides: Partial<MarketplaceProductCreationIntent> = {}): MarketplaceProductCreationIntent {
  return {
    schemaVersion: COUPANG_PRODUCT_INTENT_SCHEMA_VERSION,
    variant: "MARKETPLACE",
    listingRevisionId: "listing-revision-KK946-v1",
    requested: false,
    vendorRef: "vendor:gonggamline",
    wingUserRef: "wing-user:gonggamline-admin",
    displayCategoryCode: "78877",
    sellerProductName: "KK946 검증 상품",
    displayProductName: "KK946 검증 상품",
    generalProductName: "검증 상품",
    outboundShippingPlaceCode: "OUTBOUND-001",
    returnCenterCode: "RETURN-001",
    items: [{
      externalVendorSku: "KK946-BLACK",
      itemName: "검증 상품 블랙",
      images: [{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: "asset:rights-cleared/kk946-main.jpg" }],
      attributes: [{ attributeTypeName: "색상", attributeValueName: "블랙" }],
      notices: [{ noticeCategoryName: "기타 재화", noticeCategoryDetailName: "품명 및 모델명", content: "KK946" }],
      certifications: [{ certificationType: "NOT_REQUIRED", certificationCode: "" }],
      requiredDocuments: [],
    }],
    ...overrides,
  };
}

function evidence(overrides: Partial<MarketplacePreflightEvidence> = {}): MarketplacePreflightEvidence {
  return {
    categorySnapshot,
    vendor: {
      observedAt: "2026-08-08T00:30:00.000Z",
      vendorRef: "vendor:gonggamline",
      outboundShippingPlaceCodes: ["OUTBOUND-001"],
      returnCenterCodes: ["RETURN-001"],
    },
    ...overrides,
  };
}

test("validated Marketplace evidence produces a local READY result only", () => {
  const result = preflightMarketplaceProductCreation(intent(), evidence(), "2026-08-08T01:00:00.000Z");
  assert.equal(result.status, "READY");
  assert.equal(result.externalCallPerformed, false);
  assert.equal(result.coupangAcceptanceProven, false);
  assert.match(result.payloadFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.evidenceFingerprint, /^sha256:[a-f0-9]{64}$/);
});

test("fingerprints are deterministic and do not mutate inputs", () => {
  const source = intent();
  const before = structuredClone(source);
  const first = preflightMarketplaceProductCreation(source, evidence(), "2026-08-08T01:00:00.000Z");
  const second = preflightMarketplaceProductCreation(structuredClone(source), evidence(), "2026-08-08T01:00:00.000Z");
  assert.equal(first.payloadFingerprint, second.payloadFingerprint);
  assert.deepEqual(source, before);
});

test("Rocket and approval-request intents fail closed", () => {
  const result = preflightMarketplaceProductCreation(
    { ...intent(), variant: "ROCKET_GROWTH", requested: true } as unknown as MarketplaceProductCreationIntent,
    evidence(),
    "2026-08-08T01:00:00.000Z",
  );
  assert.equal(result.status, "INVALID");
  assert.deepEqual(
    new Set(result.issues.map(({ code }) => code)),
    new Set(["APPROVAL_REQUEST_PROHIBITED", "UNSUPPORTED_VARIANT"]),
  );
});

test("missing real assets and vendor evidence remain explicitly incomplete", () => {
  const source = intent({
    items: [{ ...intent().items[0], images: [] }],
    outboundShippingPlaceCode: "UNPROVEN-OUTBOUND",
  });
  const result = preflightMarketplaceProductCreation(source, evidence(), "2026-08-08T01:00:00.000Z");
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.issues.some(({ code }) => code === "REPRESENTATION_IMAGE_MISSING"));
  assert.ok(result.issues.some(({ code }) => code === "OUTBOUND_LOCATION_NOT_PROVEN"));
});

test("duplicate SKU and exposed option tuples are invalid", () => {
  const first = intent().items[0];
  const result = preflightMarketplaceProductCreation(
    intent({ items: [first, { ...first }] }),
    evidence(),
    "2026-08-08T01:00:00.000Z",
  );
  assert.equal(result.status, "INVALID");
  assert.ok(result.issues.some(({ code }) => code === "INVALID_OR_DUPLICATE_SKU"));
  assert.ok(result.issues.some(({ code }) => code === "DUPLICATE_EXPOSED_OPTION_TUPLE"));
});

test("category, identity, and stale evidence mismatches cannot become READY", () => {
  const result = preflightMarketplaceProductCreation(
    intent({ displayCategoryCode: "99999", wingUserRef: "vendor:gonggamline" }),
    evidence({ vendor: { ...evidence().vendor, observedAt: "2026-07-01T00:00:00.000Z" } }),
    "2026-08-08T01:00:00.000Z",
  );
  assert.equal(result.status, "INVALID");
  assert.ok(result.issues.some(({ code }) => code === "CATEGORY_CODE_MISMATCH"));
  assert.ok(result.issues.some(({ code }) => code === "IDENTITY_REFS_NOT_DISTINCT"));
  assert.ok(result.issues.some(({ code }) => code === "VENDOR_EVIDENCE_STALE_OR_INVALID"));
});
