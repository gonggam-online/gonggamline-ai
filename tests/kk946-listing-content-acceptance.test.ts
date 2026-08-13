import assert from "node:assert/strict";
import test from "node:test";
import { buildListingContentPacket } from "../engines/listing/content-pipeline.ts";
import { kk946AcceptanceInput, kk946CommerceFields } from "./fixtures/kk946-listing-content.ts";

test("KK946 acceptance packet uses confirmed facts but remains quarantined", () => {
  const result = buildListingContentPacket(kk946AcceptanceInput(), kk946CommerceFields);
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
