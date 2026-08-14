import { digestCanonicalJson } from "@/engines/listing/category-snapshot";
import type {
  CreativeProductRepresentationDecision,
  CreativeProductRepresentationReview,
  RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type {
  ArchivedListingCreativeAsset,
  PublishedListingCreativeAsset,
} from "@/shared/domain/listing-creative-storage";

const SHA256 = /^[a-f0-9]{64}$/;

const PRODUCT_REVIEW_FIELDS = [
  "productIdentity",
  "color",
  "quantity",
  "dimensionsAndScale",
  "material",
  "components",
  "optionConsistency",
  "prohibitedMarks",
  "unsupportedClaims",
  "crop",
  "encoding",
  "load",
] as const;

type ProductReviewField = (typeof PRODUCT_REVIEW_FIELDS)[number];

export type CreativeProductRepresentationReviewInput = Readonly<{
  reviewReference: string;
  reviewerReference: string;
  reviewedAt: string;
  reviewedArtifactDigest: string;
}> & Readonly<Record<ProductReviewField, CreativeProductRepresentationDecision>>;

export function createProductRepresentationReview(
  input: CreativeProductRepresentationReviewInput,
): CreativeProductRepresentationReview {
  if (
    input.reviewReference.trim().length === 0
    || input.reviewerReference.trim().length === 0
    || !Number.isFinite(Date.parse(input.reviewedAt))
    || !SHA256.test(input.reviewedArtifactDigest)
  ) throw new Error("PRODUCT_REPRESENTATION_REVIEW_INVALID");
  const reviewDigest = digestCanonicalJson({
    schemaVersion: "gonggamline-listing-product-representation-review-v1",
    ...input,
  });
  if (!reviewDigest) throw new Error("PRODUCT_REPRESENTATION_REVIEW_INVALID");
  return Object.freeze({ ...input, reviewDigest });
}

export function productRepresentationReviewPasses(
  review: CreativeProductRepresentationReview | null,
): review is CreativeProductRepresentationReview {
  if (!review) return false;
  const { reviewDigest, ...reviewInput } = review;
  const expectedDigest = digestCanonicalJson({
    schemaVersion: "gonggamline-listing-product-representation-review-v1",
    ...reviewInput,
  });
  return Boolean(
    SHA256.test(reviewDigest)
    && expectedDigest === reviewDigest
    && PRODUCT_REVIEW_FIELDS.every((field) => review[field] === "PASS"),
  );
}

function computedQaPasses(artifact: RenderedCreativeArtifact): boolean {
  return Object.entries(artifact.review)
    .filter(([name]) => name !== "deployability")
    .every(([, result]) => result === "PASS");
}

export function attachArchivedCreativeArtifact(
  artifact: RenderedCreativeArtifact,
  archived: ArchivedListingCreativeAsset,
): RenderedCreativeArtifact {
  const descriptor = archived.descriptor;
  if (
    artifact.providerKind !== "EXTERNAL_IMAGE_PROVIDER"
    || artifact.deployability !== "NONDEPLOYABLE"
    || !computedQaPasses(artifact)
    || descriptor.artifactId !== artifact.artifactId
    || descriptor.candidateSetId !== artifact.candidateSetId
    || descriptor.byteDigest !== artifact.byteDigest
    || descriptor.byteSize !== artifact.byteSize
    || descriptor.width !== artifact.width
    || descriptor.height !== artifact.height
    || descriptor.mimeType !== artifact.mimeType
  ) throw new Error("ARCHIVED_CREATIVE_ARTIFACT_MISMATCH");
  return Object.freeze({
    ...artifact,
    durableAssetReference: archived.privateMasterReference,
    publicAssetReference: null,
    productRepresentationReview: null,
    deployability: "REVIEW_READY" as const,
    review: Object.freeze({ ...artifact.review, deployability: "FAIL" as const }),
  });
}
export function attachProductRepresentationReview(
  artifact: RenderedCreativeArtifact,
  review: CreativeProductRepresentationReview,
): RenderedCreativeArtifact {
  if (
    artifact.deployability !== "REVIEW_READY"
    || !artifact.durableAssetReference
    || review.reviewedArtifactDigest !== artifact.byteDigest
    || !productRepresentationReviewPasses(review)
  ) throw new Error("PRODUCT_REPRESENTATION_REVIEW_REQUIRED");
  return Object.freeze({
    ...artifact,
    productRepresentationReview: review,
  });
}

export function attachPublishedCreativeArtifact(
  artifact: RenderedCreativeArtifact,
  published: PublishedListingCreativeAsset,
): RenderedCreativeArtifact {
  if (
    artifact.deployability !== "REVIEW_READY"
    || !productRepresentationReviewPasses(artifact.productRepresentationReview)
    || published.archived.descriptor.artifactId !== artifact.artifactId
    || published.archived.descriptor.candidateSetId !== artifact.candidateSetId
    || published.archived.descriptor.byteDigest !== artifact.byteDigest
    || !/^https:\/\//.test(published.publicMirrorReference)
  ) throw new Error("PUBLISHED_CREATIVE_ARTIFACT_MISMATCH");
  return Object.freeze({
    ...artifact,
    publicAssetReference: published.publicMirrorReference,
    deployability: "DEPLOYABLE" as const,
    review: Object.freeze({ ...artifact.review, deployability: "PASS" as const }),
  });
}
