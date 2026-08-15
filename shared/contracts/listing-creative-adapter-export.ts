import type {
  ListingContentInput,
  RegistrationCommerceFields,
} from "@/shared/domain/listing-content";

export const LISTING_CREATIVE_ADAPTER_EXPORT_API_VERSION =
  "gonggamline-listing-creative-adapter-export-v1" as const;

export type ListingCreativeAdapterPacket = Readonly<{
  listingInput: ListingContentInput;
  commerce: RegistrationCommerceFields;
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
