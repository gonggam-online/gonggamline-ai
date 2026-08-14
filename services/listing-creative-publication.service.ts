import { attachPublishedCreativeArtifact } from "@/engines/listing/creative-artifact-review";
import { mapCreativePublicationApproval } from "@/engines/listing/creative-approval";
import type { ManagedListingCreativeStorage } from "@/engines/listing/creative-storage";
import type {
  CreativeCandidateSet,
  ListingCreativeReviewPacket,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type { ArchivedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";
import type { PublishedListingCreativeAsset } from "@/shared/domain/listing-creative-storage";

export async function publishSelectedCreativeCandidate(input: Readonly<{
  packet: ListingCreativeReviewPacket;
  archived: readonly ArchivedListingCreativeAsset[];
  storage: ManagedListingCreativeStorage;
  occurredAt: string;
  approvalSequenceStart: number;
  publicationSequenceStart: number;
}>): Promise<ListingCreativeReviewPacket> {
  const approval = mapCreativePublicationApproval(input.packet);
  const selected = input.packet.candidates.find(({ candidateSetId }) =>
    candidateSetId === input.packet.selectedCandidateSetId);
  if (!approval || !selected || input.archived.length !== selected.artifacts.length) {
    throw new Error("SELECTED_CREATIVE_PUBLICATION_NOT_APPROVED");
  }
  const archivedByDigest = new Map(input.archived.map((asset) => [asset.descriptor.byteDigest, asset]));
  if (
    archivedByDigest.size !== selected.artifacts.length
    || selected.artifacts.some((artifact) => {
      const archived = archivedByDigest.get(artifact.byteDigest);
      return !archived
        || archived.descriptor.artifactId !== artifact.artifactId
        || archived.descriptor.candidateSetId !== selected.candidateSetId;
    })
  ) throw new Error("SELECTED_CREATIVE_ARCHIVE_MISMATCH");

  const publishedArtifacts: RenderedCreativeArtifact[] = [];
  const publishedRecords: PublishedListingCreativeAsset[] = [];
  try {
    for (const [index, artifact] of [...selected.artifacts]
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId)).entries()) {
      const archived = archivedByDigest.get(artifact.byteDigest);
      if (!archived) throw new Error("SELECTED_CREATIVE_ARCHIVE_MISMATCH");
      const published = await input.storage.publish({
        archived,
        approval,
        occurredAt: input.occurredAt,
        approvalSequence: input.approvalSequenceStart + index * 2,
        publicationSequence: input.publicationSequenceStart + index * 2,
      });
      publishedRecords.push(published);
      publishedArtifacts.push(attachPublishedCreativeArtifact(artifact, published));
    }
  } catch (error) {
    const rollback = await Promise.allSettled([...publishedRecords].reverse().map((published, index) =>
      input.storage.takedown({
        published,
        occurredAt: input.occurredAt,
        sequence: input.publicationSequenceStart + selected.artifacts.length * 2 + index,
        reasonCode: "PARTIAL_SELECTED_SET_PUBLICATION",
      })));
    if (rollback.some(({ status }) => status === "rejected")) {
      throw new Error("SELECTED_CREATIVE_PUBLICATION_ROLLBACK_FAILED", { cause: error });
    }
    throw error;
  }

  const updatedSelected: CreativeCandidateSet = Object.freeze({
    ...selected,
    artifacts: Object.freeze(publishedArtifacts),
  });
  return Object.freeze({
    ...input.packet,
    conversionReadiness: "REVIEW_READY" as const,
    candidates: Object.freeze(input.packet.candidates.map((candidate) =>
      candidate.candidateSetId === updatedSelected.candidateSetId ? updatedSelected : candidate)),
  });
}
