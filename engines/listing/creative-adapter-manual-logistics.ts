import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { assembleMarketplacePreflightEvidence, createOpaqueCoupangVendorRef } from "@/lib/coupang/preflight-evidence";
import type { LogisticsAddressSelector } from "@/shared/contracts/coupang-preflight-evidence";
import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";

const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export type OwnerConfirmedLogisticsInput = Readonly<{
  vendorId: string;
  observedAt: string;
  sourceReference: string;
  approvalReference: string;
  outbound: Readonly<{ code: string; selector: LogisticsAddressSelector }>;
  returnCenter: Readonly<{ code: string; selector: LogisticsAddressSelector }>;
}>;

function required(value: string, path: string): string {
  if (value.trim() === "") throw new Error(`ADAPTER_MANUAL_LOGISTICS_INVALID:${path}`);
  return value;
}

function selector(value: LogisticsAddressSelector, path: string): LogisticsAddressSelector {
  required(value.zipCode, `${path}.zipCode`);
  required(value.address, `${path}.address`);
  return Object.freeze({ ...value });
}

function evidenceDigest(input: OwnerConfirmedLogisticsInput): `sha256:${string}` {
  const digest = digestCanonicalJson({
    vendorId: input.vendorId,
    observedAt: input.observedAt,
    sourceReference: input.sourceReference,
    approvalReference: input.approvalReference,
    outbound: input.outbound,
    returnCenter: input.returnCenter,
  });
  if (!digest) throw new Error("ADAPTER_MANUAL_LOGISTICS_DIGEST_FAILED");
  return `sha256:${digest}`;
}

export function importOwnerConfirmedListingCreativeAdapterLogistics(
  packet: ListingCreativeAdapterPacket,
  input: OwnerConfirmedLogisticsInput,
): ListingCreativeAdapterPacket {
  required(input.vendorId, "vendorId");
  required(input.sourceReference, "sourceReference");
  required(input.approvalReference, "approvalReference");
  if (!/^owner[:/]/u.test(input.approvalReference)) throw new Error("ADAPTER_MANUAL_LOGISTICS_INVALID:approvalReference");
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("ADAPTER_MANUAL_LOGISTICS_INVALID:observedAt");
  if (!SAFE_CODE.test(input.outbound.code)) throw new Error("ADAPTER_MANUAL_LOGISTICS_INVALID:outbound.code");
  if (!SAFE_CODE.test(input.returnCenter.code)) throw new Error("ADAPTER_MANUAL_LOGISTICS_INVALID:returnCenter.code");
  const outboundSelector = selector(input.outbound.selector, "outbound.selector");
  const returnSelector = selector(input.returnCenter.selector, "returnCenter.selector");
  const vendorRef = createOpaqueCoupangVendorRef(input.vendorId);
  const responseDigest = evidenceDigest(input);
  const source = Object.freeze({
    observedAt: input.observedAt,
    sourceUrl: input.sourceReference,
    schemaVersion: "gonggamline-coupang-evidence-v1" as const,
    rulesetVersion: "gonggamline-coupang-evidence-rules-v1" as const,
    responseDigest,
  });
  const evidence = assembleMarketplacePreflightEvidence({
    categorySnapshot: packet.listingInput.category,
    outbound: { vendorRef, outboundShippingPlaceCode: input.outbound.code, usable: true, source },
    returnCenter: { vendorRef, returnCenterCode: input.returnCenter.code, source },
  });
  if (!evidence) throw new Error("ADAPTER_MANUAL_LOGISTICS_EVIDENCE_CONFLICT");
  return Object.freeze({
    listingInput: packet.listingInput,
    commerce: Object.freeze({
      ...packet.commerce,
      outboundShippingPlaceCode: input.outbound.code,
      returnCenterCode: input.returnCenter.code,
      logisticsEvidence: evidence,
      logisticsEvidenceMode: "OWNER_CONFIRMED_WING" as const,
      logisticsAddressSelectors: Object.freeze({ outbound: outboundSelector, returnCenter: returnSelector }),
      logisticsApprovalReference: input.approvalReference,
    }),
  });
}
