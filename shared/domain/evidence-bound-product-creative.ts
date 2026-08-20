import { createHash } from "node:crypto";

export const PRODUCT_CREATIVE_PACKET_VERSION =
  "gonggamline-evidence-bound-product-creative-v1" as const;

export const ASSET_RIGHTS_POLICY_DIGEST =
  "cb06faeb826d3fc3e51c12b4faf5d3c9123d1258670f253b242671fcfd6921c0" as const;
export const ASSET_ERROR_ISOLATION_POLICY_DIGEST =
  "cb2c15f8973586df4dc7ae1d022568901beaf54822743e3c36b704fc7728ed1c" as const;

export type CreativeEditOperation =
  | "ORIGINAL_USE"
  | "CROP_SQUARE"
  | "BACKGROUND_REMOVE"
  | "BRIGHTNESS_ADJUST";

export type CreativeEvidenceState = "VERIFIED" | "UNKNOWN" | "CONFLICT" | "PROHIBITED";

export type CreativeAssetEvidence = Readonly<{
  assetId: string;
  assetDigest: string;
  sourceReference: string;
  productFactIds: readonly string[];
  state: CreativeEvidenceState;
  rights: Readonly<{
    grantReference: string;
    grantDigest: string;
    grantorReference: string;
    reviewedAt: string;
    expiresAt: string;
    revoked: boolean;
    usePermission: "ALLOWED" | "UNKNOWN" | "PROHIBITED";
    editPermissions: Readonly<Partial<Record<CreativeEditOperation, "ALLOWED" | "UNKNOWN" | "PROHIBITED">>>;
  }>;
  visualEvidence: Readonly<{
    productIdentityMatch: number;
    productCoveragePercent: number;
    mobileLegibility: number;
    competitorDifferentiation: number;
    conversionUsefulness: number;
  }>;
}>;

export type CreativePolicySnapshot = Readonly<{
  policyVersion: string;
  categoryId: string;
  state: "APPROVED" | "UNKNOWN" | "CONFLICT" | "PROHIBITED";
  categoryEvidenceDigest: string;
  marketplacePolicyDigest: string;
  observedAt: string;
  expiresAt: string;
  allowedOperations: readonly CreativeEditOperation[];
  minProductCoveragePercent: number;
  maxProductCoveragePercent: number;
}>;

export type CreativeCandidate = Readonly<{
  candidateId: string;
  assetId: string;
  rank: number;
  status: "VERIFIED" | "QUARANTINED";
  operation: CreativeEditOperation;
  brief: string;
  score: number | null;
  scoreBreakdown: Readonly<{
    productIdentity: number;
    keywordRelevance: number;
    policyCompliance: number;
    visualClarity: number;
    conversionUsefulness: number;
    rightsProvenance: number;
  }>;
  provenance: Readonly<{
    sourceAssetDigest: string;
    grantDigest: string;
    productFactIds: readonly string[];
    keywordPacketDigest: string;
    titlePacketDigest: string;
    categoryEvidenceDigest: string;
    marketplacePolicyDigest: string;
    transformation: Readonly<{ operation: CreativeEditOperation; changesProductFacts: false }>;
  }>;
  exclusionReasons: readonly string[];
}>;

export type ProductCreativePacket = Readonly<{
  version: typeof PRODUCT_CREATIVE_PACKET_VERSION;
  candidateId: string;
  mode: "SHADOW";
  status: "READY" | "PARTIAL" | "QUARANTINED";
  executionEligible: false;
  generatedAt: string;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  titlePacketDigest: string;
  policySnapshot: CreativePolicySnapshot;
  policyBindings: Readonly<{
    assetRightsPolicyDigest: typeof ASSET_RIGHTS_POLICY_DIGEST;
    assetErrorIsolationPolicyDigest: typeof ASSET_ERROR_ISOLATION_POLICY_DIGEST;
  }>;
  assetManifest: readonly Readonly<{
    assetId: string;
    assetDigest: string;
    state: "ELIGIBLE" | "QUARANTINED";
    allowedOperations: readonly CreativeEditOperation[];
    exclusionReasons: readonly string[];
  }>[];
  candidates: readonly CreativeCandidate[];
  quarantinedAssetIds: readonly string[];
  humanReview: Readonly<{
    required: true;
    status: "PENDING" | "APPROVED" | "REJECTED";
    selectedCandidateId: string | null;
    reviewerReference: string | null;
    reviewedAt: string | null;
  }>;
  rollback: Readonly<{
    strategy: "DISCARD_SHADOW_PACKET";
    sourceAssetDigests: readonly string[];
  }>;
  digest: string;
}>;

const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const OPERATION_ORDER: readonly CreativeEditOperation[] = [
  "ORIGINAL_USE", "CROP_SQUARE", "BACKGROUND_REMOVE", "BRIGHTNESS_ADJUST",
];

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function inRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function withoutDigest(packet: ProductCreativePacket): Omit<ProductCreativePacket, "digest"> {
  const { digest: packetDigest, ...value } = packet;
  void packetDigest;
  return value;
}

export function productCreativePacketDigest(packet: ProductCreativePacket): string {
  return digest(withoutDigest(packet));
}

function operationBrief(operation: CreativeEditOperation, assetId: string): string {
  const descriptions: Record<CreativeEditOperation, string> = {
    ORIGINAL_USE: "권리 승인된 원본을 사실 변경 없이 대표 이미지 후보로 검토",
    CROP_SQUARE: "상품의 색상·수량·구성·크기·인증을 변경하지 않고 정사각형으로 크롭",
    BACKGROUND_REMOVE: "상품 픽셀과 사실을 변경하지 않고 배경만 제거",
    BRIGHTNESS_ADJUST: "상품 색상 표현을 왜곡하지 않는 범위에서 전체 밝기만 보정",
  };
  return `${assetId}: ${descriptions[operation]}`;
}

export function buildProductCreativePacket(input: Readonly<{
  candidateId: string;
  generatedAt: string;
  keywordSetVersion: string;
  keywordPacketDigest: string;
  expectedKeywordPacketDigest: string;
  keywordRelevanceScore: number;
  titlePacketDigest: string;
  expectedTitlePacketDigest: string;
  policySnapshot: CreativePolicySnapshot;
  assets: readonly CreativeAssetEvidence[];
}>): ProductCreativePacket {
  if (!ID.test(input.candidateId)) throw new RangeError("candidateId is invalid.");
  if (!ID.test(input.keywordSetVersion)) throw new RangeError("keywordSetVersion is invalid.");
  if (!SHA256.test(input.keywordPacketDigest) || input.keywordPacketDigest !== input.expectedKeywordPacketDigest) {
    throw new Error("KEYWORD_PACKET_DIGEST_MISMATCH");
  }
  if (!inRange(input.keywordRelevanceScore)) throw new RangeError("keywordRelevanceScore is invalid.");
  if (!SHA256.test(input.titlePacketDigest) || input.titlePacketDigest !== input.expectedTitlePacketDigest) {
    throw new Error("TITLE_PACKET_DIGEST_MISMATCH");
  }
  const now = new Date(input.generatedAt);
  if (!Number.isFinite(now.getTime())) throw new RangeError("generatedAt is invalid.");
  const policyObservedAt = Date.parse(input.policySnapshot.observedAt);
  const policyExpiresAt = Date.parse(input.policySnapshot.expiresAt);
  if (!Number.isFinite(policyObservedAt) || !Number.isFinite(policyExpiresAt)) throw new RangeError("policy snapshot time is invalid.");
  if (!SHA256.test(input.policySnapshot.categoryEvidenceDigest) || !SHA256.test(input.policySnapshot.marketplacePolicyDigest)) {
    throw new Error("POLICY_EVIDENCE_DIGEST_INVALID");
  }
  if (![input.policySnapshot.minProductCoveragePercent, input.policySnapshot.maxProductCoveragePercent].every(inRange)
      || input.policySnapshot.minProductCoveragePercent > input.policySnapshot.maxProductCoveragePercent) {
    throw new RangeError("product coverage policy is invalid.");
  }

  const policyReasons: string[] = [];
  if (input.policySnapshot.state !== "APPROVED") policyReasons.push(`POLICY_${input.policySnapshot.state}`);
  if (now.getTime() < policyObservedAt || now.getTime() > policyExpiresAt) policyReasons.push("POLICY_STALE");

  const manifest: ProductCreativePacket["assetManifest"][number][] = [];
  const candidates: CreativeCandidate[] = [];
  for (const asset of [...input.assets].sort((left, right) => left.assetId.localeCompare(right.assetId))) {
    if (!ID.test(asset.assetId)) throw new RangeError("assetId is invalid.");
    if (!SHA256.test(asset.assetDigest) || !SHA256.test(asset.rights.grantDigest)) throw new Error("ASSET_DIGEST_INVALID");
    if (![asset.visualEvidence.productIdentityMatch, asset.visualEvidence.productCoveragePercent,
      asset.visualEvidence.mobileLegibility, asset.visualEvidence.competitorDifferentiation,
      asset.visualEvidence.conversionUsefulness].every(inRange)) throw new RangeError("visual evidence score is invalid.");

    const reasons = [...policyReasons];
    if (asset.state !== "VERIFIED") reasons.push(`ASSET_EVIDENCE_${asset.state}`);
    if (!asset.sourceReference.startsWith("evidence:")) reasons.push("ASSET_SOURCE_REFERENCE_INVALID");
    if (!asset.rights.grantReference.startsWith("evidence:") || !asset.rights.grantorReference.startsWith("evidence:")) reasons.push("RIGHTS_GRANT_REFERENCE_INVALID");
    if (asset.rights.revoked) reasons.push("RIGHTS_REVOKED");
    if (asset.rights.usePermission !== "ALLOWED") reasons.push(`RIGHTS_USE_${asset.rights.usePermission}`);
    const reviewedAt = Date.parse(asset.rights.reviewedAt);
    const expiresAt = Date.parse(asset.rights.expiresAt);
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(expiresAt) || now.getTime() < reviewedAt || now.getTime() > expiresAt) reasons.push("RIGHTS_STALE");
    if (asset.productFactIds.length === 0) reasons.push("PRODUCT_FACT_EVIDENCE_MISSING");
    if (asset.visualEvidence.productCoveragePercent < input.policySnapshot.minProductCoveragePercent
      || asset.visualEvidence.productCoveragePercent > input.policySnapshot.maxProductCoveragePercent) reasons.push("PRODUCT_COVERAGE_OUT_OF_POLICY");

    const allowedOperations = OPERATION_ORDER.filter((operation) =>
      input.policySnapshot.allowedOperations.includes(operation)
      && asset.rights.editPermissions[operation] === "ALLOWED");
    if (allowedOperations.length === 0) reasons.push("EDIT_PERMISSION_MISSING");
    const uniqueReasons = [...new Set(reasons)].sort();
    manifest.push(Object.freeze({
      assetId: asset.assetId,
      assetDigest: asset.assetDigest,
      state: uniqueReasons.length === 0 ? "ELIGIBLE" : "QUARANTINED",
      allowedOperations: Object.freeze(allowedOperations),
      exclusionReasons: Object.freeze(uniqueReasons),
    }));
    if (uniqueReasons.length > 0) continue;

    for (const operation of allowedOperations) {
      const operationReasons: string[] = [];
      const keywordRelevance = input.keywordRelevanceScore;
      const visualClarity = round((asset.visualEvidence.productCoveragePercent + asset.visualEvidence.mobileLegibility) / 2);
      const scoreBreakdown = Object.freeze({
        productIdentity: asset.visualEvidence.productIdentityMatch,
        keywordRelevance,
        policyCompliance: 100,
        visualClarity,
        conversionUsefulness: round((asset.visualEvidence.conversionUsefulness + asset.visualEvidence.competitorDifferentiation) / 2),
        rightsProvenance: 100,
      });
      const score = round(scoreBreakdown.productIdentity * 0.25 + scoreBreakdown.keywordRelevance * 0.15
        + scoreBreakdown.policyCompliance * 0.2 + scoreBreakdown.visualClarity * 0.15
        + scoreBreakdown.conversionUsefulness * 0.15 + scoreBreakdown.rightsProvenance * 0.1);
      candidates.push(Object.freeze({
        candidateId: `${asset.assetId}:${operation.toLocaleLowerCase("en-US")}`,
        assetId: asset.assetId,
        rank: 0,
        status: operationReasons.length === 0 ? "VERIFIED" : "QUARANTINED",
        operation,
        brief: operationBrief(operation, asset.assetId),
        score,
        scoreBreakdown,
        provenance: Object.freeze({
          sourceAssetDigest: asset.assetDigest,
          grantDigest: asset.rights.grantDigest,
          productFactIds: Object.freeze([...new Set(asset.productFactIds)].sort()),
          keywordPacketDigest: input.keywordPacketDigest,
          titlePacketDigest: input.titlePacketDigest,
          categoryEvidenceDigest: input.policySnapshot.categoryEvidenceDigest,
          marketplacePolicyDigest: input.policySnapshot.marketplacePolicyDigest,
          transformation: Object.freeze({ operation, changesProductFacts: false as const }),
        }),
        exclusionReasons: Object.freeze(operationReasons),
      }));
    }
  }

  const ranked = candidates
    .sort((left, right) => (right.score ?? -1) - (left.score ?? -1) || left.candidateId.localeCompare(right.candidateId))
    .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1 }));
  const quarantinedAssetIds = manifest.filter(({ state }) => state === "QUARANTINED").map(({ assetId }) => assetId);
  const packetWithoutDigest = {
    version: PRODUCT_CREATIVE_PACKET_VERSION,
    candidateId: input.candidateId,
    mode: "SHADOW" as const,
    status: ranked.length === 0 ? "QUARANTINED" as const : quarantinedAssetIds.length > 0 ? "PARTIAL" as const : "READY" as const,
    executionEligible: false as const,
    generatedAt: now.toISOString(),
    keywordSetVersion: input.keywordSetVersion,
    keywordPacketDigest: input.keywordPacketDigest,
    titlePacketDigest: input.titlePacketDigest,
    policySnapshot: Object.freeze({ ...input.policySnapshot, allowedOperations: Object.freeze([...new Set(input.policySnapshot.allowedOperations)].sort()) }),
    policyBindings: Object.freeze({ assetRightsPolicyDigest: ASSET_RIGHTS_POLICY_DIGEST, assetErrorIsolationPolicyDigest: ASSET_ERROR_ISOLATION_POLICY_DIGEST }),
    assetManifest: Object.freeze(manifest),
    candidates: Object.freeze(ranked),
    quarantinedAssetIds: Object.freeze(quarantinedAssetIds),
    humanReview: Object.freeze({ required: true as const, status: "PENDING" as const, selectedCandidateId: null, reviewerReference: null, reviewedAt: null }),
    rollback: Object.freeze({ strategy: "DISCARD_SHADOW_PACKET" as const, sourceAssetDigests: Object.freeze(manifest.map(({ assetDigest }) => assetDigest).sort()) }),
  };
  return Object.freeze({ ...packetWithoutDigest, digest: digest(packetWithoutDigest) });
}

export function reviewProductCreativePacket(packet: ProductCreativePacket, review: Readonly<{
  decision: "APPROVED" | "REJECTED";
  selectedCandidateId: string | null;
  reviewerReference: string;
  reviewedAt: string;
}>): ProductCreativePacket {
  if (productCreativePacketDigest(packet) !== packet.digest) throw new Error("CREATIVE_PACKET_DIGEST_MISMATCH");
  if (!review.reviewerReference.startsWith("reviewer:")) throw new Error("REVIEWER_REFERENCE_INVALID");
  const reviewedAt = new Date(review.reviewedAt);
  if (!Number.isFinite(reviewedAt.getTime())) throw new RangeError("reviewedAt is invalid.");
  if (review.decision === "APPROVED" && !packet.candidates.some(({ candidateId, status }) => candidateId === review.selectedCandidateId && status === "VERIFIED")) {
    throw new Error("CREATIVE_CANDIDATE_NOT_APPROVABLE");
  }
  if (review.decision === "REJECTED" && review.selectedCandidateId !== null) throw new Error("REJECTED_REVIEW_CANNOT_SELECT_CANDIDATE");
  const withoutReviewDigest = {
    ...withoutDigest(packet),
    humanReview: Object.freeze({
      required: true as const,
      status: review.decision,
      selectedCandidateId: review.selectedCandidateId,
      reviewerReference: review.reviewerReference,
      reviewedAt: reviewedAt.toISOString(),
    }),
  };
  return Object.freeze({ ...withoutReviewDigest, digest: digest(withoutReviewDigest) });
}
