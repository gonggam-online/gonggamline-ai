import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";
import type { ListingLiveWriteApprovalRecord, ListingLiveWriteApprovalRevisionBinding } from "@/shared/domain/listing-live-write-approval";

export const LISTING_LIVE_WRITE_APPROVAL_API_VERSION =
  "gonggamline-listing-live-write-approval-v1" as const;

export type ListingLiveWriteApprovalRequest = Readonly<{
  schemaVersion: typeof LISTING_LIVE_WRITE_APPROVAL_API_VERSION;
  confirmation: "APPROVE_WING_LIVE_WRITE";
  packet: ListingCreativeAdapterPacket;
  revision: ListingLiveWriteApprovalRevisionBinding;
}>;

export type ListingLiveWriteApprovalResponse = Readonly<{
  schemaVersion: typeof LISTING_LIVE_WRITE_APPROVAL_API_VERSION;
  status: "ISSUED";
  approval: ListingLiveWriteApprovalRecord;
}>;
