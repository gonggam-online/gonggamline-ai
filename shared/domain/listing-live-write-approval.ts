import type { ListingCreativeAdapterPacket } from "@/shared/contracts/listing-creative-adapter-export";

export const LISTING_LIVE_WRITE_APPROVAL_VERSION =
  "gonggamline-listing-live-write-approval-v1" as const;

export const LISTING_LIVE_WRITE_APPROVAL_CONFIRMATION =
  "APPROVE_WING_LIVE_WRITE" as const;

export type ListingLiveWriteApprovalRevisionBinding = Readonly<{
  packetId: string;
  evaluationId: string;
  evaluatedAt: string;
  sourceReference: string;
  contentApprovalReference: string;
}>;

export type ListingLiveWriteApprovalRecord = Readonly<{
  schemaVersion: typeof LISTING_LIVE_WRITE_APPROVAL_VERSION;
  approvalReference: string;
  approvalDigest: string;
  approvalTargetDigest: string;
  revisionBindingDigest: string;
  packetId: string;
  subjectId: string;
  evaluationId: string;
  evaluatedAt: string;
  sourceReferenceDigest: string;
  contentApprovalReferenceDigest: string;
  actorReferenceDigest: string;
  scope: "COUPANG_WING_LIVE_WRITE";
  issuedAt: string;
  expiresAt: string;
}>;

export type ListingLiveWriteApprovalIssueInput = Readonly<{
  packet: ListingCreativeAdapterPacket;
  revision: ListingLiveWriteApprovalRevisionBinding;
  actorReference: string;
  issuedAt: string;
  expiresAt: string;
}>;
