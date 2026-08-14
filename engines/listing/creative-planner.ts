import {
  LISTING_CREATIVE_PACKET_VERSION,
  type CreativeProviderApproval,
  type CreativeCandidateSet,
  type CreativeRenderJob,
  type ListingCreativeReviewPacket,
  type RenderedCreativeArtifact,
} from "@/shared/domain/listing-creative";
import type {
  ListingContentInput,
  ListingContentPacket,
} from "@/shared/domain/listing-content";
import {
  DeterministicFixtureCreativeProvider,
  executeCreativeRenderJob,
} from "@/engines/listing/creative-renderer";
import { digestCanonicalJson } from "@/engines/listing/category-snapshot";

const FIXTURE_PROVIDER = new DeterministicFixtureCreativeProvider();

export type ListingCreativePlanningInput = Readonly<{
  packetId: string;
  subjectReference: string;
  provenFactIds: readonly string[];
  factualConstraints: readonly string[];
  evidenceEvaluationId: string;
  policyDigest: string;
  categoryMetadataDigest: string;
  revisionId: string;
}>;

const SAFE_FACT_FIELD = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SAFE_FACT_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const PRIVATE_OR_OPERATIONAL_FIELD =
  /(?:account|address|advertis|approval|contact|email|inventory|phone|price|reorder|return|rights|shipping|stock|vendor)/iu;

function normalizedFactValue(value: string | number | boolean | null): string {
  if (value === null) return "";
  const normalized = String(value).normalize("NFC").replace(/\s+/g, " ").trim();
  if (CONTROL_CHARACTER.test(normalized) || normalized.length > 500) {
    throw new Error("CREATIVE_FACT_VALUE_INVALID");
  }
  return normalized;
}

export function materializeCreativeFactConstraints(
  input: ListingContentInput,
): Readonly<{ factIds: readonly string[]; constraints: readonly string[] }> {
  if (
    input.creativeFactFields.length === 0
    || new Set(input.creativeFactFields).size !== input.creativeFactFields.length
    || input.creativeFactFields.some((field) =>
      !SAFE_FACT_FIELD.test(field) || PRIVATE_OR_OPERATIONAL_FIELD.test(field))
  ) throw new Error("CREATIVE_FACT_FIELDS_INVALID");
  const selected = input.creativeFactFields.map((field) => {
    const facts = input.evidence.facts.filter((fact) =>
      fact.field === field && fact.status === "PROVEN");
    const values = [...new Set(facts.map(({ value }) => normalizedFactValue(value)).filter(Boolean))];
    const factIds = [...new Set(facts.map(({ factId }) => factId))].sort();
    if (
      facts.length === 0
      || values.length !== 1
      || factIds.some((factId) => !SAFE_FACT_ID.test(factId))
    ) {
      throw new Error("CREATIVE_FACT_COVERAGE_INVALID");
    }
    return Object.freeze({
      factIds: Object.freeze(factIds),
      constraint: `factIds=${factIds.join(",")}; field=${field}; value=${values[0]}`,
    });
  });
  return Object.freeze({
    factIds: Object.freeze([...new Set(selected.flatMap(({ factIds }) => factIds))]),
    constraints: Object.freeze(selected.map(({ constraint }) => constraint)),
  });
}

export function planningInputFromListingContent(
  input: ListingContentInput,
): ListingCreativePlanningInput {
  const facts = materializeCreativeFactConstraints(input);
  return Object.freeze({
    packetId: input.packetId,
    subjectReference: input.subjectId,
    provenFactIds: facts.factIds,
    factualConstraints: facts.constraints,
    evidenceEvaluationId: input.evidence.evaluationId,
    policyDigest: input.policy.digest,
    categoryMetadataDigest: input.category.metadataDigest,
    revisionId: digestCanonicalJson({
      packetId: input.packetId,
      evidenceEvaluationId: input.evidence.evaluationId,
      policyDigest: input.policy.digest,
      categoryMetadataDigest: input.category.metadataDigest,
      revision: 1,
    }) ?? "",
  });
}

function renderJob(
  input: ListingCreativePlanningInput,
  candidateSetId: string,
  suffix: "main" | "detail",
  variant: number,
): CreativeRenderJob {
  const main = suffix === "main";
  return Object.freeze({
    jobId: `${input.packetId}:${candidateSetId}:${suffix}:v${variant}`,
    candidateSetId,
    subjectReference: input.subjectReference,
    role: main ? "MAIN" : "DETAIL",
    shotType: main ? "PACKSHOT" : variant === 1 ? "SCALE" : "FEATURE",
    transformation: "FACT_ONLY_SYNTHETIC",
    inputAssetDigests: [],
    inputSources: [],
    factIds: input.provenFactIds,
    width: main ? 1000 : 780,
    height: main ? 1000 : 1200,
    mimeType: "image/png",
    altText: main
      ? "합성 fixture 상품 단독 이미지 미리보기"
      : "합성 fixture 모바일 상세 이미지 미리보기",
    factualConstraints: input.factualConstraints,
    renderRecipeVersion: `deterministic-fixture-layout-v${variant}`,
    provider: FIXTURE_PROVIDER.approval,
  });
}

function externalRenderJob(
  input: ListingCreativePlanningInput,
  provider: CreativeProviderApproval,
  candidateSetId: string,
  suffix: "main" | "detail",
  variant: number,
): CreativeRenderJob {
  const main = suffix === "main";
  return Object.freeze({
    jobId: `${input.packetId}:${candidateSetId}:${suffix}:external-v${variant}`,
    candidateSetId,
    subjectReference: input.subjectReference,
    role: main ? "MAIN" : "DETAIL",
    shotType: main ? "PACKSHOT" : variant === 1 ? "SCALE" : "FEATURE",
    transformation: "FACT_ONLY_SYNTHETIC",
    inputAssetDigests: Object.freeze([]),
    inputSources: Object.freeze([]),
    factIds: input.provenFactIds,
    width: main ? 1024 : 1024,
    height: main ? 1024 : 1536,
    mimeType: "image/png",
    altText: main
      ? "검증된 상품 사실 기반 대표 이미지 후보"
      : variant === 1
        ? "검증된 크기와 상품 사실 기반 모바일 상세 이미지 후보"
        : "검증된 특징과 상품 사실 기반 모바일 상세 이미지 후보",
    factualConstraints: input.factualConstraints,
    renderRecipeVersion: `openai-fact-only-commerce-v${variant}`,
    provider,
  });
}

export function planExternalCreativeJobs(
  input: ListingCreativePlanningInput,
  provider: CreativeProviderApproval,
): readonly CreativeRenderJob[] {
  if (provider.providerKind !== "EXTERNAL_IMAGE_PROVIDER") {
    throw new Error("EXTERNAL_CREATIVE_PROVIDER_REQUIRED");
  }
  return Object.freeze([
    externalRenderJob(input, provider, "creative-a", "main", 1),
    externalRenderJob(input, provider, "creative-a", "detail", 1),
    externalRenderJob(input, provider, "creative-b", "main", 2),
    externalRenderJob(input, provider, "creative-b", "detail", 2),
  ]);
}

function detailPackageDigest(
  candidateSetId: string,
  artifacts: readonly RenderedCreativeArtifact[],
): string {
  return digestCanonicalJson({
    schemaVersion: "gonggamline-listing-creative-detail-package-v1",
    candidateSetId,
    artifacts: [...artifacts]
      .sort((left, right) => left.artifactId.localeCompare(right.artifactId))
      .filter(({ role }) => role === "DETAIL")
      .map(({ artifactId, byteDigest, width, height, mimeType, altText }) => ({
        artifactId,
        byteDigest,
        width,
        height,
        mimeType,
        altText,
      })),
  }) ?? "";
}

function filterSetDigest(listing: ListingContentPacket): string {
  const payload = listing.registrationPayload;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  const item = items.length === 1 && typeof items[0] === "object" && items[0] !== null
    ? items[0] as Record<string, unknown>
    : null;
  return digestCanonicalJson({
    attributes: item && Array.isArray(item.attributes) ? item.attributes : [],
  }) ?? "";
}

export function buildExternalCreativeReviewPacket(input: Readonly<{
  planning: ListingCreativePlanningInput;
  listing: ListingContentPacket;
  jobs: readonly CreativeRenderJob[];
  artifacts: readonly RenderedCreativeArtifact[];
}>): ListingCreativeReviewPacket {
  if (
    input.listing.status !== "REGISTRATION_READY"
    || input.jobs.length !== 4
    || input.artifacts.length !== input.jobs.length
  ) throw new Error("EXTERNAL_CREATIVE_REVIEW_INPUT_INVALID");
  const jobsById = new Map(input.jobs.map((job) => [job.jobId, job]));
  if (
    jobsById.size !== input.jobs.length
    || ["creative-a", "creative-b"].some((candidateSetId) => {
      const candidateJobs = input.jobs.filter((job) => job.candidateSetId === candidateSetId);
      const roles = candidateJobs.map(({ role }) => role).sort();
      return candidateJobs.length !== 2
        || roles[0] !== "DETAIL"
        || roles[1] !== "MAIN";
    })
    || input.jobs.some((job) =>
      job.transformation !== "FACT_ONLY_SYNTHETIC"
      || job.inputAssetDigests.length !== 0
      || job.inputSources.length !== 0
      || job.provider.providerKind !== "EXTERNAL_IMAGE_PROVIDER"
      || (job.role === "MAIN" && (job.width !== 1024 || job.height !== 1024))
      || (job.role === "DETAIL" && (job.width !== 1024 || job.height !== 1536)))
    || input.artifacts.some((artifact) => {
      const job = jobsById.get(artifact.jobId);
      return !job
        || artifact.candidateSetId !== job.candidateSetId
        || artifact.providerKind !== "EXTERNAL_IMAGE_PROVIDER"
        || artifact.providerId !== job.provider.providerId
        || artifact.providerModelVersion !== job.provider.modelVersion
        || artifact.providerTermsVersion !== job.provider.termsVersion
        || artifact.byteDigest.length !== 64
        || artifact.deployability !== "REVIEW_READY"
        || !artifact.durableAssetReference
        || artifact.publicAssetReference !== null
        || artifact.productRepresentationReview !== null
        || artifact.providerExecution === null
        || Object.entries(artifact.review)
          .filter(([name]) => name !== "deployability")
          .some(([, result]) => result !== "PASS");
    })
  ) throw new Error("EXTERNAL_CREATIVE_REVIEW_INPUT_INVALID");
  const listingVariants = input.listing.conversion.candidates;
  if (listingVariants.length < 2) throw new Error("EXTERNAL_CREATIVE_VARIANTS_REQUIRED");
  const candidates: CreativeCandidateSet[] = ["creative-a", "creative-b"].map(
    (candidateSetId, index) => {
      const jobs = input.jobs.filter((job) => job.candidateSetId === candidateSetId);
      const artifacts = input.artifacts.filter((artifact) =>
        artifact.candidateSetId === candidateSetId);
      const variant = listingVariants[index];
      return Object.freeze({
        candidateSetId,
        label: index === 0 ? "정확한 상품 식별 우선" : "핵심 특징 탐색 우선",
        rationale: Object.freeze(index === 0
          ? ["흰색·중립 배경의 상품 단독 표현과 검증된 크기 정보를 우선"]
          : ["검증된 특징을 모바일 스캔 흐름에서 먼저 확인하는 cold-start prior"]),
        confidence: "LOW" as const,
        titleCandidateId: variant.variantId,
        keywordCandidateId: variant.variantId,
        filterSetDigest: filterSetDigest(input.listing),
        detailPackageDigest: detailPackageDigest(candidateSetId, artifacts),
        renderJobs: Object.freeze(jobs),
        artifacts: Object.freeze(artifacts),
      });
    },
  );
  return Object.freeze({
    schemaVersion: LISTING_CREATIVE_PACKET_VERSION,
    packetId: `${input.planning.packetId}:creative-external-review`,
    subjectReference: input.planning.subjectReference,
    evidenceEvaluationId: input.planning.evidenceEvaluationId,
    policyDigest: input.planning.policyDigest,
    categoryMetadataDigest: input.planning.categoryMetadataDigest,
    revisionId: input.planning.revisionId,
    registrationReadiness: "PASS",
    conversionReadiness: "REVIEW_READY",
    candidates: Object.freeze(candidates),
    selectedCandidateSetId: null,
    contentApproval: {
      approved: false,
      approvalReference: null,
      reviewerReference: null,
      approvedAt: null,
      approvalDigest: null,
      boundArtifactDigests: [],
      boundProductReviewDigests: [],
      boundProviderExecutionDigests: [],
      boundEvidenceEvaluationId: null,
      boundPolicyDigest: null,
      boundCategoryMetadataDigest: null,
      boundCandidateSetId: null,
      boundTitleCandidateId: null,
      boundKeywordCandidateId: null,
      boundFilterSetDigest: null,
      boundDetailPackageDigest: null,
      boundRenderRecipeVersions: [],
      boundRevisionId: null,
    },
    liveWriteApproval: { approved: false, approvalReference: null },
    issues: Object.freeze([{
      code: "PRODUCT_REPRESENTATION_REVIEW_REQUIRED",
      severity: "OPTIMIZATION_PENDING" as const,
      path: "creative.candidates",
      message: "실제 provider 출력은 비공개 보관됐지만 상품표현 사람 검토와 선택 승인이 필요합니다.",
    }]),
  });
}

export function planFixtureCreativeJobs(input: ListingCreativePlanningInput): readonly CreativeRenderJob[] {
  return Object.freeze([
    renderJob(input, "creative-a", "main", 1),
    renderJob(input, "creative-a", "detail", 1),
    renderJob(input, "creative-b", "main", 2),
    renderJob(input, "creative-b", "detail", 2),
  ]);
}

export async function buildFixtureCreativeReviewPacket(
  input: ListingCreativePlanningInput,
): Promise<ListingCreativeReviewPacket> {
  const jobs = planFixtureCreativeJobs(input);
  const artifacts = await Promise.all(jobs.map((job) => executeCreativeRenderJob(job, FIXTURE_PROVIDER)));
  const candidates: CreativeCandidateSet[] = ["creative-a", "creative-b"].map((candidateSetId, index) => {
    const candidateJobs = jobs.filter((job) => job.candidateSetId === candidateSetId);
    return {
      candidateSetId,
      label: index === 0 ? "정보 우선 구성" : "특징 우선 구성",
      rationale: index === 0
        ? ["상품 식별과 크기 정보를 먼저 검토하는 cold-start prior"]
        : ["핵심 특징과 모바일 스캔 흐름을 먼저 검토하는 cold-start prior"],
      confidence: "LOW",
      titleCandidateId: `title-${index === 0 ? "a" : "b"}`,
      keywordCandidateId: `keywords-${index === 0 ? "a" : "b"}`,
      filterSetDigest: digestCanonicalJson({ candidateSetId, kind: "synthetic-filter-fixture" }) ?? "",
      detailPackageDigest: digestCanonicalJson({
        candidateSetId,
        kind: "synthetic-detail-fixture",
        jobs: candidateJobs.map(({ jobId, role, width, height }) => ({ jobId, role, width, height })),
      }) ?? "",
      renderJobs: candidateJobs,
      artifacts: artifacts.filter((artifact) => artifact.candidateSetId === candidateSetId),
    };
  });
  return Object.freeze({
    schemaVersion: LISTING_CREATIVE_PACKET_VERSION,
    packetId: `${input.packetId}:creative-fixture-review`,
    subjectReference: input.subjectReference,
    evidenceEvaluationId: input.evidenceEvaluationId,
    policyDigest: input.policyDigest,
    categoryMetadataDigest: input.categoryMetadataDigest,
    revisionId: input.revisionId,
    registrationReadiness: "PASS",
    conversionReadiness: "FIXTURE_PREVIEW",
    candidates: Object.freeze(candidates),
    selectedCandidateSetId: null,
    contentApproval: {
      approved: false,
      approvalReference: null,
      reviewerReference: null,
      approvedAt: null,
      approvalDigest: null,
      boundArtifactDigests: [],
      boundProductReviewDigests: [],
      boundProviderExecutionDigests: [],
      boundEvidenceEvaluationId: null,
      boundPolicyDigest: null,
      boundCategoryMetadataDigest: null,
      boundCandidateSetId: null,
      boundTitleCandidateId: null,
      boundKeywordCandidateId: null,
      boundFilterSetDigest: null,
      boundDetailPackageDigest: null,
      boundRenderRecipeVersions: [],
      boundRevisionId: null,
    },
    liveWriteApproval: { approved: false, approvalReference: null },
    issues: Object.freeze([{
      code: "REAL_PROVIDER_AND_MANAGED_ASSET_STORE_REQUIRED",
      severity: "OPTIMIZATION_PENDING" as const,
      path: "creative.provider",
      message: "실제 provider와 관리형 자산 저장소가 승인되지 않아 fixture 미리보기는 배포할 수 없습니다.",
    }]),
  });
}
