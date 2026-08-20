import assert from "node:assert/strict";
import test from "node:test";

import { mapApprovedListingPacketToCoupangOfflineDryRun } from "../shared/domain/coupang-payload-offline-dry-run.ts";
import { buildListingGeneratorV2Packet } from "../shared/domain/listing-generator-v2.ts";
import type { CoupangProductPayload } from "../types/coupang.ts";
import { listingGeneratorV2FixtureInput } from "./listing-generator-v2.test.ts";

const evaluatedAt = "2026-08-20T05:00:00.000Z";

function basePayload(): CoupangProductPayload {
  return {
    displayCategoryCode: 78877,
    sellerProductName: "기존 제목",
    displayProductName: "기존 제목",
    generalProductName: "기존 제목",
    saleStartedAt: "2026-08-20T00:00:00.000Z",
    saleEndedAt: "2027-08-20T00:00:00.000Z",
    deliveryMethod: "SEQUENCIAL",
    deliveryChargeType: "FREE",
    returnCenterCode: "RET-1",
    companyContactNumber: "02-0000-0000",
    returnZipCode: "00000",
    returnAddress: "합성 주소",
    returnAddressDetail: "합성 상세 주소",
    outboundShippingPlaceCode: "OUT-1",
    vendorUserId: "synthetic-user",
    items: [{
      itemName: "기존 옵션",
      originalPrice: 20_000,
      salePrice: 15_000,
      maximumBuyCount: 10,
      images: [{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: "https://assets.invalid/old.png" }],
      attributes: [{ attributeTypeName: "색상", attributeValueName: "합성" }],
      contents: [{ contentsType: "HTML", contentDetails: [{ content: "<p>기존</p>", detailType: "TEXT" }] }],
    }],
  };
}

function validInput() {
  const packet = buildListingGeneratorV2Packet(listingGeneratorV2FixtureInput());
  return {
    packet,
    expectedPacketDigest: packet.digest,
    evaluatedAt,
    approval: { state: "APPROVED" as const, packetDigest: packet.digest, approvedAt: "2026-08-20T04:30:00.000Z", validUntil: "2026-08-21T04:30:00.000Z", reviewerReference: "review:synthetic:stage-16" },
    categoryEvidence: { state: "VERIFIED" as const, categoryId: packet.policyBinding.categoryId, displayCategoryCode: 78877, digest: packet.policyBinding.categoryEvidenceDigest, observedAt: "2026-08-20T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" },
    policyEvidence: { state: "APPROVED" as const, digest: packet.policyBinding.marketplacePolicyDigest, observedAt: "2026-08-20T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" },
    rightsEvidence: packet.provenance.rights.map((right) => ({ ...right, state: "VERIFIED" as const })),
    basePayload: basePayload(),
  };
}

test("maps an exact approved packet deterministically without changing commerce values", () => {
  const input = validInput();
  const first = mapApprovedListingPacketToCoupangOfflineDryRun(input);
  const second = mapApprovedListingPacketToCoupangOfflineDryRun(input);
  assert.deepEqual(first, second);
  assert.equal(first.status, "VALID");
  assert.equal(first.externalCallPerformed, false);
  assert.equal(first.enqueued, false);
  assert.equal(first.submitted, false);
  assert.equal(first.packetDigest, "e5e69b5e9903d3a6ca5012d8840a8cebc611ca8346edf16591c7b4c0590f5306");
  assert.match(first.payloadDigest ?? "", /^[a-f0-9]{64}$/);
  assert.equal(first.payload?.items[0]?.salePrice, input.basePayload.items[0]?.salePrice);
  assert.equal(first.payload?.items[0]?.originalPrice, input.basePayload.items[0]?.originalPrice);
  assert.equal(first.payload?.items[0]?.maximumBuyCount, input.basePayload.items[0]?.maximumBuyCount);
  assert.equal(first.payload?.deliveryMethod, input.basePayload.deliveryMethod);
  assert.equal(first.payload?.sellerProductName, input.packet.listingDraft.title);
  assert.equal(first.payload?.items[0]?.images[0]?.vendorPath, input.packet.listingDraft.rightsClearedAssets[0]?.reference);
});

test("unknown, conflict, prohibited, revoked and stale evidence always quarantines without a payload", () => {
  const cases = [
    { ...validInput(), approval: { ...validInput().approval, state: "UNKNOWN" as const } },
    { ...validInput(), categoryEvidence: { ...validInput().categoryEvidence, state: "CONFLICT" as const } },
    { ...validInput(), policyEvidence: { ...validInput().policyEvidence, state: "PROHIBITED" as const } },
    { ...validInput(), rightsEvidence: validInput().rightsEvidence.map((right) => ({ ...right, state: "REVOKED" as const })) },
    { ...validInput(), approval: { ...validInput().approval, validUntil: "2026-08-20T04:59:59.000Z" } },
  ];
  for (const input of cases) {
    const result = mapApprovedListingPacketToCoupangOfflineDryRun(input);
    assert.equal(result.status, "QUARANTINED");
    assert.equal(result.payload, null);
    assert.equal(result.payloadDigest, null);
    assert.equal(result.externalCallPerformed, false);
    assert.equal(result.enqueued, false);
    assert.equal(result.submitted, false);
  }
});

test("packet, approval, category, policy and rights binding mismatches fail closed", () => {
  const input = validInput();
  const cases = [
    { ...input, expectedPacketDigest: "0".repeat(64) },
    { ...input, approval: { ...input.approval, packetDigest: "0".repeat(64) } },
    { ...input, categoryEvidence: { ...input.categoryEvidence, displayCategoryCode: 1 } },
    { ...input, policyEvidence: { ...input.policyEvidence, digest: "0".repeat(64) } },
    { ...input, rightsEvidence: input.rightsEvidence.map((right) => ({ ...right, grantDigest: "0".repeat(64) })) },
    { ...input, rightsEvidence: [...input.rightsEvidence, ...input.rightsEvidence] },
  ];
  for (const candidate of cases) {
    const result = mapApprovedListingPacketToCoupangOfflineDryRun(candidate);
    assert.equal(result.status, "QUARANTINED");
    assert.equal(result.payload, null);
    assert.ok(result.quarantineReasons.some((reason) => reason.includes("BINDING_MISMATCH")));
  }
});

test("invalid existing payload is quarantined and no registration surface is imported", () => {
  const input = validInput();
  const result = mapApprovedListingPacketToCoupangOfflineDryRun({ ...input, basePayload: { ...input.basePayload, items: [] } });
  assert.equal(result.status, "QUARANTINED");
  assert.deepEqual(result.quarantineReasons, ["PAYLOAD_INVALID"]);
  assert.equal(result.payload, null);
});
