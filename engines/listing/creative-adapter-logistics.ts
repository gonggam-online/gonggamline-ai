import { assembleMarketplacePreflightEvidence, createCoupangEvidenceReader } from "@/lib/coupang/preflight-evidence";
import type { LogisticsAddressSelector } from "@/shared/contracts/coupang-preflight-evidence";
import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";

export type AdapterLogisticsReader = Readonly<{
  readOutboundByAddress: (selector: LogisticsAddressSelector) => ReturnType<ReturnType<typeof createCoupangEvidenceReader>["readOutboundByAddress"]>;
  readReturnCenterByAddress: (selector: LogisticsAddressSelector) => ReturnType<ReturnType<typeof createCoupangEvidenceReader>["readReturnCenterByAddress"]>;
}>;

export async function enrichListingCreativeAdapterLogistics(
  packet: ListingCreativeAdapterPacket,
  selectors: Readonly<{ outbound: LogisticsAddressSelector; returnCenter: LogisticsAddressSelector }>,
  reader: AdapterLogisticsReader = createCoupangEvidenceReader(),
): Promise<ListingCreativeAdapterPacket> {
  const [outbound, returnCenter] = await Promise.all([
    reader.readOutboundByAddress(selectors.outbound),
    reader.readReturnCenterByAddress(selectors.returnCenter),
  ]);
  if (!outbound.ok) throw new Error(`ADAPTER_LOGISTICS_${outbound.code}`);
  if (!returnCenter.ok) throw new Error(`ADAPTER_LOGISTICS_${returnCenter.code}`);
  const evidence = assembleMarketplacePreflightEvidence({
    categorySnapshot: packet.listingInput.category,
    outbound: outbound.evidence,
    returnCenter: returnCenter.evidence,
  });
  if (!evidence) throw new Error("ADAPTER_LOGISTICS_EVIDENCE_CONFLICT");
  return Object.freeze({
    listingInput: packet.listingInput,
    commerce: Object.freeze({
      ...packet.commerce,
      outboundShippingPlaceCode: outbound.evidence.outboundShippingPlaceCode,
      returnCenterCode: returnCenter.evidence.returnCenterCode,
      logisticsEvidence: evidence,
    }),
  });
}
