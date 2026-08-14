import assert from "node:assert/strict";
import test from "node:test";
import { buildListingContentPacket } from "../engines/listing/content-pipeline.ts";
import {
  buildFixtureCreativeReviewPacket,
  planExternalCreativeJobs,
  planningInputFromListingContent,
} from "../engines/listing/creative-planner.ts";
import { mapApprovedCreativeCandidate } from "../engines/listing/creative-approval.ts";
import {
  kk946AcceptanceInput,
  kk946CommerceFields,
  kk946WingCategoryMetadataObservation,
  kk946WingRegistrationAdapter,
} from "./fixtures/kk946-listing-content.ts";

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
  const { input, commerce } = kk946WingRegistrationAdapter({ vendorUserId: "fixture:private-wing-user", outboundShippingPlaceCode: "fixture:private-outbound", returnCenterCode: "fixture:private-return-center", companyContactNumber: "fixture:private-wing-contact", returnZipCode: "00000", returnAddress: "fixture:private-return-address", returnAddressDetail: "fixture:private-return-detail" });
  const result = buildListingContentPacket(input, commerce);
  assert.equal(result.status, "REGISTRATION_READY");
  assert.ok(result.registrationPayload);
  assert.equal(input.category.displayCategoryCode, "69291");
  assert.equal(kk946WingCategoryMetadataObservation.internalCategoryId, "2979");
  assert.deepEqual(kk946WingCategoryMetadataObservation.fullPath, ["패션의류잡화", "여성패션", "여성잡화", "가방", "여성파우치"]);
  assert.equal(result.title.value, "미니 파우치 충전기 케이블 수납 KK946");
  assert.deepEqual(result.keywords.map(({ text }) => text), ["충전기 파우치", "케이블 파우치", "소형 수납 파우치", "투명 파우치", "미니 파우치", "충전기 케이블 수납", "KK946"]);
  assert.equal(result.assets[0].disposition, "INCLUDED");
  assert.equal(result.assets[0].outputDigest, "d3ab260cef16fd5fc0485591b01fe0571d3d5f04b61832159b5029a2c4797bcf");
  assert.equal(result.assets[1].disposition, "EXCLUDED");
  assert.equal(result.assets[2].disposition, "DERIVATIVE_UNAVAILABLE");
  assert.deepEqual(result.detailPage.review, { encoding: "PASS", mobileWidth: "PASS", readability: "PASS", assetReferences: "PASS", claims: "PASS", crop: "PASS", productFacts: "PASS", load: "PASS" });
  assert.equal(commerce.salePrice, 4290);
  assert.equal(commerce.stockQuantity, 6);
  assert.equal(commerce.deliveryChargeType, "FREE");
  assert.deepEqual(commerce.options.map(({ name, value }) => [name, value]), [["색상", "블랙"], ["패션의류/잡화 사이즈", "FREE"]]);
  assert.ok(commerce.searchFilters.some(({ name, value }) => name === "파우치 종류" && value === "일반/다용도"));
  assert.ok(commerce.notices.every(({ value, factIds }) => value.length > 0 && factIds.length > 0));
  assert.ok(result.issues.some(({ code, severity }) => code === "DERIVATIVE_UNAVAILABLE" && severity === "WARNING"));
  assert.ok(result.issues.some(({ code, severity }) => code === "MAIN_IMAGE_OPTIMIZATION_PENDING" && severity === "OPTIMIZATION_PENDING"));
  assert.ok(result.issues.some(({ code, severity }) => code === "OWNER_APPROVED_ASSUMPTION" && severity === "WARNING"));
  assert.ok(!result.issues.some(({ severity }) => severity === "BLOCKER"));
});

test("KK946 minimum packet stays ready while synthetic renderer output remains review-only", async () => {
  const { input, commerce } = kk946WingRegistrationAdapter({
    vendorUserId: "fixture:private-wing-user",
    outboundShippingPlaceCode: "fixture:private-outbound",
    returnCenterCode: "fixture:private-return-center",
    companyContactNumber: "fixture:private-wing-contact",
    returnZipCode: "00000",
    returnAddress: "fixture:private-return-address",
    returnAddressDetail: "fixture:private-return-detail",
  });
  const registration = buildListingContentPacket(input, commerce);
  const creative = await buildFixtureCreativeReviewPacket(planningInputFromListingContent(input));

  assert.equal(registration.status, "REGISTRATION_READY");
  assert.equal(creative.candidates.length, 2);
  assert.ok(creative.candidates.flatMap(({ artifacts }) => artifacts).every(({ deployability }) => deployability === "FIXTURE_ONLY"));
  assert.equal(mapApprovedCreativeCandidate(creative), null);
});

test("KK946 external creative plan uses admitted visible facts and sends zero supplier pixels", () => {
  const privateMarkers = [
    "fixture:private-wing-user",
    "fixture:private-outbound",
    "fixture:private-return-center",
    "fixture:private-wing-contact",
    "fixture:private-return-address",
    "fixture:private-return-detail",
  ];
  const { input } = kk946WingRegistrationAdapter({
    vendorUserId: privateMarkers[0],
    outboundShippingPlaceCode: privateMarkers[1],
    returnCenterCode: privateMarkers[2],
    companyContactNumber: privateMarkers[3],
    returnZipCode: "00000",
    returnAddress: privateMarkers[4],
    returnAddressDetail: privateMarkers[5],
  });
  const planning = planningInputFromListingContent(input);
  const jobs = planExternalCreativeJobs(planning, {
    providerKind: "EXTERNAL_IMAGE_PROVIDER",
    providerId: "fixture-openai-image-provider",
    modelVersion: "fixture-gpt-image-model",
    termsVersion: "fixture-commercial-terms",
    approvalReference: "fixture:provider-approval",
    paidUsageApproved: true,
    serverSecretApproved: true,
    managedAssetStoreApproved: true,
    outputCommercialUseApproved: true,
  });
  const serialized = JSON.stringify(jobs);

  assert.ok(jobs.every(({ inputAssetDigests, inputSources, transformation }) =>
    transformation === "FACT_ONLY_SYNTHETIC"
    && inputAssetDigests.length === 0
    && inputSources.length === 0));
  assert.match(serialized, /field=modelName; value=KK946/);
  assert.match(serialized, /field=color;/);
  assert.match(serialized, /field=dimensions; value=10\.5/);
  assert.ok(privateMarkers.every((marker) => !serialized.includes(marker)));
  assert.doesNotMatch(serialized, /domeggook\.com|supplier-asset|sourceReference/iu);
});
