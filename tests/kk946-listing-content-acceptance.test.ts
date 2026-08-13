import assert from "node:assert/strict";
import test from "node:test";
import { buildListingContentPacket } from "../engines/listing/content-pipeline.ts";
import { kk946AcceptanceInput, kk946CommerceFields } from "./fixtures/kk946-listing-content.ts";
import { genericCategorySnapshot, genericCommerceFields } from "./fixtures/listing-content.ts";

test("KK946 acceptance packet is blocked by exact category and required notices, not unknown edit rights", () => {
  const input = kk946AcceptanceInput();
  const result = buildListingContentPacket(input, kk946CommerceFields);
  assert.equal(result.subjectId, "KK946");
  assert.equal(result.status, "REGISTRATION_BLOCKED");
  assert.equal(result.registrationPayload, null);
  assert.ok(result.title.value.includes("미니 파우치"));
  assert.ok(result.title.value.includes("블랙"));
  assert.ok(result.detailPage.html.includes("폴리에스터"));
  assert.ok(result.detailPage.html.includes("10.5 × 3.6 × 6.5 cm"));
  assert.ok(result.issues.some(({ code, severity }) => code === "DERIVATIVE_UNAVAILABLE" && severity === "WARNING"));
  assert.ok(result.issues.some(({ code }) => code === "UNKNOWN_REQUIRED_FACT"));
  assert.ok(result.issues.some(({ code }) => code === "CATEGORY_NOT_VALIDATED"));
  assert.ok(!result.issues.some(({ code, severity }) => code === "DERIVATIVE_UNAVAILABLE" && severity === "BLOCKER"));
  const trustedFacts = input.evidence.facts.filter(({ reviewerReference }) => reviewerReference === "trust-profile:domeggook-approved-catalog:2026-08-13.owner-v1");
  assert.equal(trustedFacts.length, 5);
  assert.ok(trustedFacts.every(({ status, sourceReference }) => status === "PROVEN" && sourceReference.includes("#trust=2026-08-13.owner-v1")));
});

test("KK946 unchanged supplier image remains usable while derivatives are warning-only exclusions", () => {
  for (const transformation of ["CROP", "BACKGROUND_REMOVAL", "TEXT_OVERLAY", "COMPOSITE", "GENERATIVE_REFERENCE"] as const) {
    const input = kk946AcceptanceInput();
    const assetRequests = input.assetRequests.map((request, index) => index === 0 ? request : ({ ...request, transformation }));
    const result = buildListingContentPacket({ ...input, assetRequests }, kk946CommerceFields);
    assert.ok(result.issues.some(({ code, severity }) => code === "DERIVATIVE_UNAVAILABLE" && severity === "WARNING"), transformation);
    assert.equal(result.assets[0].disposition, "INCLUDED");
    assert.equal(result.assets[1].disposition, "DERIVATIVE_UNAVAILABLE");
  }
});

test("KK946 commercial fields retain the accepted six-unit experiment values without making it ready", () => {
  assert.equal(kk946CommerceFields.salePrice, 4290);
  assert.equal(kk946CommerceFields.stockQuantity, 6);
  assert.equal(kk946CommerceFields.deliveryChargeType, "FREE");
  assert.equal(buildListingContentPacket(kk946AcceptanceInput(), kk946CommerceFields).approval.livePublishAuthorized, false);
});

test("KK946 accepts an externally injected exact-category adapter without production hardcoding", () => {
  const input = kk946AcceptanceInput();
  const adapterFacts = [
    { ...input.evidence.facts[0], factId: "kk946-adapter-category", field: "coupangCategoryContract", value: "external-validated-category" },
    { ...input.evidence.facts[0], factId: "kk946-adapter-notice", field: "productNoticeFacts", value: "external-validated-notice" },
  ];
  assert.ok(input.contentApproval);
  const adaptedInput = { ...input, category: genericCategorySnapshot, evidence: { ...input.evidence, facts: [...input.evidence.facts, ...adapterFacts] }, contentApproval: { ...input.contentApproval, categoryMetadataDigest: genericCategorySnapshot.metadataDigest } };
  const baseCommerce = genericCommerceFields();
  const commerce = { ...baseCommerce, liveWriteApproval: { approved: true, approvalReference: "fixture:external-adapter-approval" }, originalPrice: 4290, salePrice: 4290, maximumBuyCount: 6, stockQuantity: 6, attributes: [], searchFilters: [{ name: "색상", value: "블랙", factIds: ["kk946-inspection-3"] }], notices: [{ name: "품명 및 모델명", value: "미니 파우치", factIds: ["kk946-adapter-notice"] }] };
  const result = buildListingContentPacket(adaptedInput, commerce);
  assert.equal(result.status, "REGISTRATION_READY");
  assert.ok(result.registrationPayload);
  assert.equal(result.assets[0].disposition, "INCLUDED");
  assert.equal(result.assets[1].disposition, "DERIVATIVE_UNAVAILABLE");
  assert.ok(result.issues.some(({ code, severity }) => code === "DERIVATIVE_UNAVAILABLE" && severity === "WARNING"));
  assert.ok(!result.issues.some(({ severity }) => severity === "BLOCKER"));
});
