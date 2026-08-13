import type { MarketplacePreflightEvidenceV2 } from "@/shared/contracts/coupang-preflight-evidence";
import type { MarketplacePreflightEvidence } from "@/shared/contracts/coupang-product-preflight";

function oldestObservation(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

export function mapCoupangEvidenceToProductPreflight(evidence: MarketplacePreflightEvidenceV2): MarketplacePreflightEvidence {
  return Object.freeze({
    categorySnapshot: evidence.categorySnapshot,
    vendor: Object.freeze({
      observedAt: oldestObservation(evidence.outbound.source.observedAt, evidence.returnCenter.source.observedAt),
      vendorRef: evidence.outbound.vendorRef,
      outboundShippingPlaceCodes: Object.freeze([evidence.outbound.outboundShippingPlaceCode]),
      returnCenterCodes: Object.freeze([evidence.returnCenter.returnCenterCode]),
    }),
  });
}
