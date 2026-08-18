import assert from "node:assert/strict";
import test from "node:test";

import { enrichListingCreativeAdapterLogistics } from "../engines/listing/creative-adapter-logistics.ts";
import { parseListingCreativeAdapterPacket } from "../engines/listing/creative-adapter-export.ts";
import type { EvidenceReadResult, LogisticsAddressSelector } from "../shared/contracts/coupang-preflight-evidence.ts";
import type { ListingCreativeAdapterPacket } from "../shared/contracts/listing-creative-adapter-export.ts";
import type { OutboundLocationEvidence, ReturnCenterEvidence } from "../shared/contracts/coupang-preflight-evidence.ts";
import { genericCommerceFields, genericListingInput } from "./fixtures/listing-content.ts";

const source = { observedAt: "2026-08-18T00:00:00.000Z", sourceUrl: "https://api-gateway.coupang.com/read-only", schemaVersion: "gonggamline-coupang-evidence-v1" as const, rulesetVersion: "gonggamline-coupang-evidence-rules-v1" as const, responseDigest: `sha256:${"a".repeat(64)}` as `sha256:${string}` };
const outbound: OutboundLocationEvidence = { vendorRef: "coupang-vendor:fixture", outboundShippingPlaceCode: "OUT-123", usable: true, source };
const returnCenter: ReturnCenterEvidence = { vendorRef: "coupang-vendor:fixture", returnCenterCode: "RET-123", source };
const selectors: Readonly<{ outbound: LogisticsAddressSelector; returnCenter: LogisticsAddressSelector }> = {
  outbound: { placeName: "fixture outbound", zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호" },
  returnCenter: { placeName: "fixture return", zipCode: "12345", address: "서울시 중구 세종대로", addressDetail: "101호" },
};

function draft(): ListingCreativeAdapterPacket {
  const commerce = genericCommerceFields();
  return parseListingCreativeAdapterPacket({ listingInput: genericListingInput(), commerce: { ...commerce, outboundShippingPlaceCode: "", returnCenterCode: "" } }, { allowUnresolvedLogistics: true });
}

test("address enrichment resolves both codes and binds read-only evidence", async () => {
  const reader = {
    readOutboundByAddress: async (): Promise<EvidenceReadResult<OutboundLocationEvidence>> => ({ ok: true, evidence: outbound }),
    readReturnCenterByAddress: async (): Promise<EvidenceReadResult<ReturnCenterEvidence>> => ({ ok: true, evidence: returnCenter }),
  };
  const result = await enrichListingCreativeAdapterLogistics(draft(), selectors, reader);
  assert.equal(result.commerce.outboundShippingPlaceCode, "OUT-123");
  assert.equal(result.commerce.returnCenterCode, "RET-123");
  assert.equal(result.commerce.logisticsEvidence?.outbound.outboundShippingPlaceCode, "OUT-123");
  assert.equal(result.commerce.logisticsEvidence?.returnCenter.returnCenterCode, "RET-123");
});

test("unresolved logistics draft is accepted only by the explicit enrichment parser", () => {
  const commerce = genericCommerceFields();
  assert.throws(() => parseListingCreativeAdapterPacket({ listingInput: genericListingInput(), commerce: { ...commerce, outboundShippingPlaceCode: "", returnCenterCode: "" } }));
  assert.doesNotThrow(() => parseListingCreativeAdapterPacket({ listingInput: genericListingInput(), commerce: { ...commerce, outboundShippingPlaceCode: "", returnCenterCode: "" } }, { allowUnresolvedLogistics: true }));
});

test("address ambiguity or provider failure never becomes a packet", async () => {
  const reader = {
    readOutboundByAddress: async (): Promise<EvidenceReadResult<OutboundLocationEvidence>> => ({ ok: false, code: "EVIDENCE_CONFLICT" }),
    readReturnCenterByAddress: async (): Promise<EvidenceReadResult<ReturnCenterEvidence>> => ({ ok: true, evidence: returnCenter }),
  };
  await assert.rejects(() => enrichListingCreativeAdapterLogistics(draft(), selectors, reader), /ADAPTER_LOGISTICS_EVIDENCE_CONFLICT/);
});
