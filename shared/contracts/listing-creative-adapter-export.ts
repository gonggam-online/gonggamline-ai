import type {
  ListingContentInput,
  RegistrationCommerceFields,
} from "@/shared/domain/listing-content";
import type { LogisticsAddressSelector, MarketplacePreflightEvidenceV2 } from "@/shared/contracts/coupang-preflight-evidence";

export const LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION =
  "gonggamline-listing-creative-adapter-export-v1" as const;

export type ListingCreativeAdapterPacket = Readonly<{
  listingInput: ListingContentInput;
  commerce: RegistrationCommerceFields;
}>;

export const LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION =
  "gonggamline-listing-creative-adapter-enrich-v1" as const;

export type ListingCreativeAdapterEnrichmentRequest = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION;
  packet: unknown;
  logistics: Readonly<{
    outbound: LogisticsAddressSelector;
    returnCenter: LogisticsAddressSelector;
  }>;
}>;

export type ListingCreativeAdapterEnrichmentResult = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_ENRICH_API_VERSION;
  packet: ListingCreativeAdapterPacket;
  readiness: ListingCreativeAdapterReadiness;
  evidence: MarketplacePreflightEvidenceV2;
  generatedAt: string;
}>;

export const LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION =
  "gonggamline-listing-creative-adapter-manual-logistics-v1" as const;

export type ListingCreativeAdapterManualLogisticsRequest = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_MANUAL_LOGISTICS_API_VERSION;
  packet: unknown;
  evidence: Readonly<{
    vendorId: string;
    observedAt: string;
    sourceReference: string;
    approvalReference: string;
    outbound: Readonly<{ code: string; selector: LogisticsAddressSelector }>;
    returnCenter: Readonly<{ code: string; selector: LogisticsAddressSelector }>;
  }>;
}>;

export type ListingCreativeAdapterExportRequest = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION;
  packet: ListingCreativeAdapterPacket;
}>;

export type ListingCreativeAdapterReadiness = Readonly<{
  status: "REGISTRATION_READY" | "REGISTRATION_BLOCKED" | "OPTIMIZATION_PENDING";
  blockerCount: number;
  warningCount: number;
  optimizationPendingCount: number;
  packetDigest: string;
  subjectId: string;
  packetId: string;
}>;

export type ListingCreativeAdapterExportDto = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION;
  exportKind: "FULL_PACKET" | "SANITIZED_REVIEW";
  packet: ListingCreativeAdapterPacket;
  readiness: ListingCreativeAdapterReadiness;
  generatedAt: string;
}>;
