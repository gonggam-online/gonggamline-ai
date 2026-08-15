import type { ListingCreativeAdapterPacket, ListingCreativeAdapterReadiness } from "@/shared/contracts/listing-creative-adapter-export";

export const LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION =
  "gonggamline-listing-creative-adapter-reprepare-v1" as const;

export type ListingCreativeAdapterRevisionMetadata = Readonly<{
  packetId: string;
  evaluationId: string;
  evaluatedAt: string;
  sourceReference: string;
  reason: "CURRENT_WING_REVIEW" | "SOURCE_REFRESH" | "EXPIRED_PACKET_REPLACEMENT";
  contentApprovalReference: string;
  liveWriteApprovalReference: string | null;
}>;

export type ListingCreativeAdapterReprepareRequest = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION;
  revision: ListingCreativeAdapterRevisionMetadata;
  packet: ListingCreativeAdapterPacket;
}>;

export type ListingCreativeAdapterReprepareResult = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_REPREPARE_API_VERSION;
  revision: ListingCreativeAdapterRevisionMetadata;
  revisionDigest: string;
  packet: ListingCreativeAdapterPacket;
  readiness: ListingCreativeAdapterReadiness;
  generatedAt: string;
}>;
