import {
  LISTING_CREATIVE_PACKET_VERSION,
  type CreativeCandidateSet,
  type CreativeRenderJob,
  type ListingCreativeReviewPacket,
} from "@/shared/domain/listing-creative";
import type { ListingContentInput } from "@/shared/domain/listing-content";
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
  factualConstraintFields: readonly string[];
  evidenceEvaluationId: string;
  policyDigest: string;
  categoryMetadataDigest: string;
  revisionId: string;
}>;

export function planningInputFromListingContent(
  input: ListingContentInput,
): ListingCreativePlanningInput {
  return Object.freeze({
    packetId: input.packetId,
    subjectReference: input.subjectId,
    provenFactIds: input.evidence.facts
      .filter(({ status }) => status === "PROVEN")
      .map(({ factId }) => factId),
    factualConstraintFields: input.corePurchaseFields,
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
    factualConstraints: input.factualConstraintFields,
    renderRecipeVersion: `deterministic-fixture-layout-v${variant}`,
    provider: FIXTURE_PROVIDER.approval,
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
