import { buildListingContentPacket } from "@/engines/listing/content-pipeline";
import {
  buildExternalCreativeReviewPacket,
  planExternalCreativeJobs,
  planningInputFromListingContent,
} from "@/engines/listing/creative-planner";
import type { ListingCreativeProvider } from "@/engines/listing/creative-renderer";
import type { ManagedListingCreativeStorage } from "@/engines/listing/creative-storage";
import { executeAndArchiveCreativeRender } from "@/services/listing-creative-render.service";
import type {
  ListingContentInput,
  ListingContentPacket,
  RegistrationCommerceFields,
} from "@/shared/domain/listing-content";
import type {
  ListingCreativeReviewPacket,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type { ArchivedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";

export type ListingCreativePrivateReviewAsset = Readonly<{
  artifactId: string;
  candidateSetId: string;
  role: RenderedCreativeArtifact["role"];
  byteDigest: string;
  width: number;
  height: number;
  mimeType: RenderedCreativeArtifact["mimeType"];
  signedReviewUrl: string;
  signedReviewUrlTtlSeconds: number;
}>;

export type ListingCreativeDispatchResult = Readonly<{
  listing: ListingContentPacket;
  creative: ListingCreativeReviewPacket;
  archived: readonly ArchivedListingCreativeAsset[];
  privateReviewAssets: readonly ListingCreativePrivateReviewAsset[];
}>;

export async function generateAndArchiveListingCreative(input: Readonly<{
  listingInput: ListingContentInput;
  commerce: RegistrationCommerceFields;
  provider: ListingCreativeProvider;
  storage: ManagedListingCreativeStorage;
  occurredAt: string;
  archiveSequenceStart: number;
  signedReviewUrlTtlSeconds?: number;
}>): Promise<ListingCreativeDispatchResult> {
  const ttlSeconds = input.signedReviewUrlTtlSeconds ?? 15 * 60;
  if (
    !Number.isFinite(Date.parse(input.occurredAt))
    || !Number.isSafeInteger(input.archiveSequenceStart)
    || input.archiveSequenceStart < 0
    || !Number.isSafeInteger(ttlSeconds)
    || ttlSeconds < 60
    || ttlSeconds > 3600
    || input.provider.approval.providerKind !== "EXTERNAL_IMAGE_PROVIDER"
  ) throw new Error("LISTING_CREATIVE_DISPATCH_INVALID");
  const listing = buildListingContentPacket(input.listingInput, input.commerce);
  if (listing.status !== "REGISTRATION_READY" || !listing.registrationPayload) {
    throw new Error("LISTING_REGISTRATION_PACKET_NOT_READY");
  }
  const planning = planningInputFromListingContent(input.listingInput);
  const jobs = planExternalCreativeJobs(planning, input.provider.approval);
  const artifacts: RenderedCreativeArtifact[] = [];
  const archived: ArchivedListingCreativeAsset[] = [];
  for (const [index, job] of jobs.entries()) {
    const result = await executeAndArchiveCreativeRender({
      job,
      provider: input.provider,
      storage: input.storage,
      revisionDigest: planning.revisionId,
      occurredAt: input.occurredAt,
      archiveSequence: input.archiveSequenceStart + index,
    });
    artifacts.push(result.artifact);
    archived.push(result.archived);
  }
  const creative = buildExternalCreativeReviewPacket({ planning, listing, jobs, artifacts });
  const privateReviewAssets = await Promise.all(archived.map(async (asset) => Object.freeze({
    artifactId: asset.descriptor.artifactId,
    candidateSetId: asset.descriptor.candidateSetId,
    role: asset.descriptor.role,
    byteDigest: asset.descriptor.byteDigest,
    width: asset.descriptor.width,
    height: asset.descriptor.height,
    mimeType: asset.descriptor.mimeType as RenderedCreativeArtifact["mimeType"],
    signedReviewUrl: await input.storage.createSignedReviewUrl(asset, ttlSeconds),
    signedReviewUrlTtlSeconds: ttlSeconds,
  })));
  return Object.freeze({
    listing,
    creative,
    archived: Object.freeze(archived),
    privateReviewAssets: Object.freeze(privateReviewAssets),
  });
}
