import type {
  ListingCreativeAdapterPacket,
  ListingCreativeAdapterReadiness,
} from "@/shared/contracts/listing-creative-adapter-export";

export const LISTING_CREATIVE_ADAPTER_RECOVERY_SCHEMA =
  "gonggamline-listing-creative-adapter-recovery-v1" as const;

export type ListingCreativeAdapterRecoveryRecord = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_ADAPTER_RECOVERY_SCHEMA;
  packet: ListingCreativeAdapterPacket;
  readiness: ListingCreativeAdapterReadiness;
  savedAt: string;
}>;
