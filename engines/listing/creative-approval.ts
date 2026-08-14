import type {
  CreativeCandidateSet,
  ListingCreativeReviewPacket,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";

export type ApprovedCreativePayload = Readonly<{
  packetId: string;
  selectedCandidateSetId: string;
  approvalReference: string;
  artifacts: readonly RenderedCreativeArtifact[];
  artifactDigests: readonly string[];
}>;

function selectedCandidate(packet: ListingCreativeReviewPacket): CreativeCandidateSet | null {
  if (!packet.selectedCandidateSetId) return null;
  return packet.candidates.find(({ candidateSetId }) => candidateSetId === packet.selectedCandidateSetId) ?? null;
}

export function mapApprovedCreativeCandidate(
  packet: ListingCreativeReviewPacket,
): ApprovedCreativePayload | null {
  const candidate = selectedCandidate(packet);
  if (!candidate || !packet.contentApproval.approved || !packet.contentApproval.approvalReference) return null;
  if (candidate.artifacts.length === 0 || candidate.artifacts.some(({ deployability, review }) =>
    deployability !== "DEPLOYABLE" || Object.values(review).some((result) => result !== "PASS"))) return null;
  if (candidate.artifacts.some(({ providerKind, providerApprovalReference, durableAssetReference }) =>
    providerKind !== "EXTERNAL_IMAGE_PROVIDER" || !providerApprovalReference || !durableAssetReference)) return null;
  const digests = candidate.artifacts.map(({ byteDigest }) => byteDigest);
  const recipes = candidate.artifacts.map(({ renderRecipeVersion }) => renderRecipeVersion);
  if (
    packet.contentApproval.boundArtifactDigests.length !== digests.length ||
    !digests.every((digest, index) => packet.contentApproval.boundArtifactDigests[index] === digest) ||
    packet.contentApproval.boundEvidenceEvaluationId !== packet.evidenceEvaluationId ||
    packet.contentApproval.boundPolicyDigest !== packet.policyDigest ||
    packet.contentApproval.boundCategoryMetadataDigest !== packet.categoryMetadataDigest ||
    packet.contentApproval.boundCandidateSetId !== candidate.candidateSetId ||
    packet.contentApproval.boundTitleCandidateId !== candidate.titleCandidateId ||
    packet.contentApproval.boundKeywordCandidateId !== candidate.keywordCandidateId ||
    packet.contentApproval.boundRevisionId !== packet.revisionId ||
    packet.contentApproval.boundRenderRecipeVersions.length !== recipes.length ||
    !recipes.every((recipe, index) => packet.contentApproval.boundRenderRecipeVersions[index] === recipe)
  ) return null;
  return Object.freeze({
    packetId: packet.packetId,
    selectedCandidateSetId: candidate.candidateSetId,
    approvalReference: packet.contentApproval.approvalReference,
    artifacts: candidate.artifacts,
    artifactDigests: digests,
  });
}
