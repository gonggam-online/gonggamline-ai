import assert from "node:assert/strict";
import { test } from "node:test";

import { importOwnerConfirmedListingCreativeAdapterLogistics } from "../engines/listing/creative-adapter-manual-logistics.ts";
import { evaluateListingCreativeAdapterPacket, parseListingCreativeAdapterPacket } from "../engines/listing/creative-adapter-export.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";

function draft() {
  return parseListingCreativeAdapterPacket({ listingInput: genericListingInput(), commerce: genericCommerceFields() }, { allowUnresolvedLogistics: true });
}

function confirmed(codeSuffix = "01") {
  return {
    vendorId: "fixture-vendor-01",
    observedAt: "2026-08-18T00:00:00.000Z",
    sourceReference: "wing:address-book:fixture-01",
    approvalReference: "owner:logistics:fixture-01",
    outbound: { code: `outbound-${codeSuffix}`, selector: { placeName: "개미창고", zipCode: "00000", address: "fixture outbound" } },
    returnCenter: { code: `return-${codeSuffix}`, selector: { placeName: "개미창고 반품", zipCode: "00000", address: "fixture return" } },
  } as const;
}

test("owner-confirmed WING logistics binds codes and evidence without a provider call", () => {
  const packet = importOwnerConfirmedListingCreativeAdapterLogistics(draft(), confirmed());
  assert.equal(packet.commerce.outboundShippingPlaceCode, "outbound-01");
  assert.equal(packet.commerce.returnCenterCode, "return-01");
  assert.equal(packet.commerce.logisticsEvidenceMode, "OWNER_CONFIRMED_WING");
  assert.equal(packet.commerce.logisticsApprovalReference, "owner:logistics:fixture-01");
  assert.equal(packet.commerce.logisticsEvidence?.outbound.outboundShippingPlaceCode, "outbound-01");
  assert.match(packet.commerce.logisticsEvidence?.evidenceFingerprint ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(evaluateListingCreativeAdapterPacket(packet).status, "REGISTRATION_READY");
});

test("owner-confirmed evidence digest changes when a code changes", () => {
  const first = importOwnerConfirmedListingCreativeAdapterLogistics(draft(), confirmed("01"));
  const second = importOwnerConfirmedListingCreativeAdapterLogistics(draft(), confirmed("02"));
  assert.notEqual(first.commerce.logisticsEvidence?.evidenceFingerprint, second.commerce.logisticsEvidence?.evidenceFingerprint);
});

test("manual logistics import fails closed for missing owner approval or malformed code", () => {
  assert.throws(
    () => importOwnerConfirmedListingCreativeAdapterLogistics(draft(), { ...confirmed(), approvalReference: "wing:unverified" }),
    /ADAPTER_MANUAL_LOGISTICS_INVALID:approvalReference/,
  );
  assert.throws(
    () => importOwnerConfirmedListingCreativeAdapterLogistics(draft(), { ...confirmed(), outbound: { ...confirmed().outbound, code: "bad code" } }),
    /ADAPTER_MANUAL_LOGISTICS_INVALID:outbound\.code/,
  );
  assert.throws(
    () => importOwnerConfirmedListingCreativeAdapterLogistics(draft(), { ...confirmed(), returnCenter: { ...confirmed().returnCenter, selector: { zipCode: "", address: "" } } }),
    /ADAPTER_MANUAL_LOGISTICS_INVALID:returnCenter\.selector\.zipCode/,
  );
});
