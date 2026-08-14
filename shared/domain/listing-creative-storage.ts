import type { ListingAssetRole } from "@/shared/domain/listing-content";

export const LISTING_CREATIVE_STORAGE_VERSION =
  "gonggamline-listing-creative-storage-v1" as const;

export const LISTING_CREATIVE_PRIVATE_BUCKET =
  "listing-creative-private-v1" as const;

export const LISTING_CREATIVE_PUBLIC_STORE =
  "listing-creative-public-v1" as const;

export type ListingCreativeAssetMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type ListingCreativeManifestState =
  | "RESERVED"
  | "GENERATED"
  | "ARCHIVED"
  | "APPROVED"
  | "PUBLISHED"
  | "REVOKED"
  | "TAKEDOWN_PENDING"
  | "TAKEDOWN"
  | "FAILED";

export type ListingCreativeStorageContext = Readonly<{
  subjectReference: string;
  revisionDigest: string;
  candidateSetId: string;
  artifactId: string;
  role: ListingAssetRole;
}>;

export type ListingCreativeArtifactDescriptor =
  ListingCreativeStorageContext & Readonly<{
    byteDigest: string;
    byteSize: number;
    mimeType: ListingCreativeAssetMimeType;
  }>;

export type ListingCreativeManifestEvent = Readonly<{
  schemaVersion: typeof LISTING_CREATIVE_STORAGE_VERSION;
  state: ListingCreativeManifestState;
  subjectHash: string;
  revisionDigest: string;
  candidateSetId: string;
  artifactId: string | null;
  role: ListingAssetRole | null;
  objectPath: string | null;
  objectDigest: string | null;
  approvalReference: string | null;
  reasonCode: string | null;
  occurredAt: string;
  sequence: number;
}>;

export type ListingCreativeManifestRecord = Readonly<{
  event: ListingCreativeManifestEvent;
  eventDigest: string;
  privateManifestReference: string;
}>;

export type ArchivedListingCreativeAsset = Readonly<{
  descriptor: ListingCreativeArtifactDescriptor;
  subjectHash: string;
  objectPath: string;
  privateMasterReference: string;
  manifest: ListingCreativeManifestRecord;
}>;

export type PublishedListingCreativeAsset = Readonly<{
  archived: ArchivedListingCreativeAsset;
  publicMirrorReference: string;
  manifest: ListingCreativeManifestRecord;
}>;

export type ListingCreativePublicationApproval = Readonly<{
  contentApproved: true;
  approvalReference: string;
  selectedCandidateSetId: string;
  boundRevisionDigest: string;
  boundArtifactDigests: readonly string[];
}>;
