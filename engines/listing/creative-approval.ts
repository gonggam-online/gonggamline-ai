import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import { productRepresentationReviewPasses } from "@/engines/listing/creative-artifact-review";
import type {
  CreativeCandidateSet,
  ListingCreativeReviewPacket,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type { ListingCreativePublicationApproval } from "@/shared/domain/listing-creative-storage";

const SHA256 = /^[a-f0-9]{64}$/;

export type ApprovedCreativePayload = Readonly<{
  packetId: string;
  selectedCandidateSetId: string;
  approvalReference: string;
  approvalDigest: string;
  artifacts: readonly RenderedCreativeArtifact[];
  artifactDigests: readonly string[];
  publicAssetReferences: readonly string[];
  publicationApproval: ListingCreativePublicationApproval;
}>;

function selectedCandidate(packet: ListingCreativeReviewPacket): CreativeCandidateSet | null {
  if (!packet.selectedCandidateSetId) return null;
  return packet.candidates.find(({ candidateSetId }) => candidateSetId === packet.selectedCandidateSetId) ?? null;
}

function orderedArtifacts(candidate: CreativeCandidateSet): readonly RenderedCreativeArtifact[] {
  return [...candidate.artifacts].sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

function providerExecutionDigest(artifact: RenderedCreativeArtifact): string | null {
  if (!artifact.providerExecution) return null;
  return digestCanonicalJson({
    providerKind: artifact.providerKind,
    providerId: artifact.providerId,
    providerApprovalReference: artifact.providerApprovalReference,
    providerModelVersion: artifact.providerModelVersion,
    providerTermsVersion: artifact.providerTermsVersion,
    execution: artifact.providerExecution,
  });
}

export function creativeCandidateDetailPackageDigest(
  candidate: CreativeCandidateSet,
): string | null {
  return digestCanonicalJson({
    schemaVersion: "gonggamline-listing-creative-detail-package-v1",
    candidateSetId: candidate.candidateSetId,
    artifacts: orderedArtifacts(candidate)
      .filter(({ role }) => role === "DETAIL")
      .map(({ artifactId, byteDigest, width, height, mimeType, altText }) => ({
        artifactId,
        byteDigest,
        width,
        height,
        mimeType,
        altText,
      })),
  });
}

function candidateCanBeApproved(candidate: CreativeCandidateSet): boolean {
  const artifacts = orderedArtifacts(candidate);
  const main = artifacts.filter(({ role }) => role === "MAIN");
  const additional = artifacts.filter(({ role }) => role === "ADDITIONAL");
  const details = artifacts.filter(({ role }) => role === "DETAIL");
  return artifacts.length > 0
    && main.length === 1
    && main[0].width >= 1000
    && main[0].height >= 1000
    && main[0].width === main[0].height
    && additional.length <= 9
    && details.length >= 1
    && creativeCandidateDetailPackageDigest(candidate) === candidate.detailPackageDigest
    && new Set(artifacts.map(({ artifactId }) => artifactId)).size === artifacts.length
    && new Set(artifacts.map(({ byteDigest }) => byteDigest)).size === artifacts.length
    && artifacts.every((artifact) =>
      artifact.providerKind === "EXTERNAL_IMAGE_PROVIDER"
      && Boolean(artifact.providerApprovalReference)
      && Boolean(artifact.durableAssetReference)
      && artifact.deployability !== "FIXTURE_ONLY"
      && artifact.deployability !== "NONDEPLOYABLE"
      && Object.entries(artifact.review)
        .filter(([name]) => name !== "deployability")
        .every(([, value]) => value === "PASS")
      && productRepresentationReviewPasses(artifact.productRepresentationReview)
      && Boolean(providerExecutionDigest(artifact)));
}

function approvalBinding(
  packet: ListingCreativeReviewPacket,
  candidate: CreativeCandidateSet,
): Readonly<{
  boundArtifactDigests: readonly string[];
  boundProductReviewDigests: readonly string[];
  boundProviderExecutionDigests: readonly string[];
  boundEvidenceEvaluationId: string;
  boundPolicyDigest: string;
  boundCategoryMetadataDigest: string;
  boundCandidateSetId: string;
  boundTitleCandidateId: string;
  boundKeywordCandidateId: string;
  boundFilterSetDigest: string;
  boundDetailPackageDigest: string;
  boundRenderRecipeVersions: readonly string[];
  boundRevisionId: string;
}> | null {
  if (!candidateCanBeApproved(candidate)) return null;
  const artifacts = orderedArtifacts(candidate);
  const productReviewDigests = artifacts.map(({ productRepresentationReview }) =>
    productRepresentationReview?.reviewDigest ?? "");
  const providerDigests = artifacts.map((artifact) => providerExecutionDigest(artifact) ?? "");
  if (
    !SHA256.test(packet.policyDigest)
    || !SHA256.test(packet.categoryMetadataDigest)
    || !SHA256.test(packet.revisionId)
    || !SHA256.test(candidate.filterSetDigest)
    || !SHA256.test(candidate.detailPackageDigest)
    || productReviewDigests.some((digest) => !SHA256.test(digest))
    || providerDigests.some((digest) => !SHA256.test(digest))
  ) return null;
  return Object.freeze({
    boundArtifactDigests: artifacts.map(({ byteDigest }) => byteDigest),
    boundProductReviewDigests: productReviewDigests,
    boundProviderExecutionDigests: providerDigests,
    boundEvidenceEvaluationId: packet.evidenceEvaluationId,
    boundPolicyDigest: packet.policyDigest,
    boundCategoryMetadataDigest: packet.categoryMetadataDigest,
    boundCandidateSetId: candidate.candidateSetId,
    boundTitleCandidateId: candidate.titleCandidateId,
    boundKeywordCandidateId: candidate.keywordCandidateId,
    boundFilterSetDigest: candidate.filterSetDigest,
    boundDetailPackageDigest: candidate.detailPackageDigest,
    boundRenderRecipeVersions: artifacts.map(({ renderRecipeVersion }) => renderRecipeVersion),
    boundRevisionId: packet.revisionId,
  });
}

export function createDigestBoundCreativeApproval(
  packet: ListingCreativeReviewPacket,
  input: Readonly<{
    reviewerReference: string;
    approvalReference: string;
    approvedAt: string;
  }>,
): ListingCreativeReviewPacket["contentApproval"] | null {
  const candidate = selectedCandidate(packet);
  if (
    !candidate
    || input.reviewerReference.trim().length === 0
    || input.approvalReference.trim().length === 0
    || !Number.isFinite(Date.parse(input.approvedAt))
  ) return null;
  const binding = approvalBinding(packet, candidate);
  if (!binding) return null;
  const approvalDigest = digestCanonicalJson({
    schemaVersion: "gonggamline-listing-creative-content-approval-v1",
    packetId: packet.packetId,
    reviewerReference: input.reviewerReference,
    approvalReference: input.approvalReference,
    approvedAt: input.approvedAt,
    ...binding,
  });
  if (!approvalDigest) return null;
  return Object.freeze({
    approved: true,
    reviewerReference: input.reviewerReference,
    approvalReference: input.approvalReference,
    approvedAt: input.approvedAt,
    approvalDigest,
    ...binding,
  });
}

function validApproval(packet: ListingCreativeReviewPacket, candidate: CreativeCandidateSet): boolean {
  const approval = packet.contentApproval;
  if (
    !approval.approved
    || !approval.reviewerReference
    || !approval.approvalReference
    || !approval.approvedAt
    || !approval.approvalDigest
  ) return false;
  const expected = createDigestBoundCreativeApproval(
    { ...packet, contentApproval: { ...approval, approved: false } },
    {
      reviewerReference: approval.reviewerReference,
      approvalReference: approval.approvalReference,
      approvedAt: approval.approvedAt,
    },
  );
  return Boolean(
    expected
    && expected.approvalDigest === approval.approvalDigest
    && expected.boundCandidateSetId === candidate.candidateSetId,
  );
}

export function mapApprovedCreativeCandidate(
  packet: ListingCreativeReviewPacket,
): ApprovedCreativePayload | null {
  const candidate = selectedCandidate(packet);
  if (!candidate || !validApproval(packet, candidate)) return null;
  const artifacts = orderedArtifacts(candidate);
  if (artifacts.some((artifact) =>
    artifact.deployability !== "DEPLOYABLE"
    || artifact.review.deployability !== "PASS"
    || !artifact.publicAssetReference
    || !/^https:\/\//.test(artifact.publicAssetReference))) return null;
  const approval = packet.contentApproval;
  const publicationApproval = mapCreativePublicationApproval(packet);
  if (!publicationApproval) return null;
  return Object.freeze({
    packetId: packet.packetId,
    selectedCandidateSetId: candidate.candidateSetId,
    approvalReference: approval.approvalReference ?? "",
    approvalDigest: approval.approvalDigest ?? "",
    artifacts,
    artifactDigests: artifacts.map(({ byteDigest }) => byteDigest),
    publicAssetReferences: artifacts.map(({ publicAssetReference }) => publicAssetReference ?? ""),
    publicationApproval,
  });
}

export function mapCreativePublicationApproval(
  packet: ListingCreativeReviewPacket,
): ListingCreativePublicationApproval | null {
  const candidate = selectedCandidate(packet);
  if (!candidate || !validApproval(packet, candidate)) return null;
  const approval = packet.contentApproval;
  return Object.freeze({
    contentApproved: true,
    packetId: packet.packetId,
    approvalReference: approval.approvalReference ?? "",
    reviewerReference: approval.reviewerReference ?? "",
    approvedAt: approval.approvedAt ?? "",
    contentApprovalDigest: approval.approvalDigest ?? "",
    selectedCandidateSetId: candidate.candidateSetId,
    boundRevisionDigest: packet.revisionId,
    boundArtifactDigests: approval.boundArtifactDigests,
    boundProductReviewDigests: approval.boundProductReviewDigests,
    boundProviderExecutionDigests: approval.boundProviderExecutionDigests,
    boundEvidenceEvaluationId: approval.boundEvidenceEvaluationId ?? "",
    boundPolicyDigest: approval.boundPolicyDigest ?? "",
    boundCategoryMetadataDigest: approval.boundCategoryMetadataDigest ?? "",
    boundTitleCandidateId: approval.boundTitleCandidateId ?? "",
    boundKeywordCandidateId: approval.boundKeywordCandidateId ?? "",
    boundFilterSetDigest: approval.boundFilterSetDigest ?? "",
    boundDetailPackageDigest: approval.boundDetailPackageDigest ?? "",
    boundRenderRecipeVersions: approval.boundRenderRecipeVersions,
  });
}
