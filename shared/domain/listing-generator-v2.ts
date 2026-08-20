import { createHash } from "node:crypto";

import type { KeywordIntelligencePacket } from "@/shared/domain/competitive-keyword-intelligence";
import type { ConversionDetailPagePacket } from "@/shared/domain/evidence-bound-conversion-detail-page";
import type { ProductCreativePacket } from "@/shared/domain/evidence-bound-product-creative";
import type { EvidenceBoundPersuasiveStoryPacket } from "@/shared/domain/evidence-bound-persuasive-story";
import type { EvidenceBoundTitleRankingPacket } from "@/shared/domain/evidence-bound-title-ranking";

export const LISTING_GENERATOR_V2_PACKET_VERSION =
  "gonggamline-listing-generator-v2-competitive-review-v1" as const;

type CurrentRightsAttestation = Readonly<{
  creativeCandidateId: string;
  sourceAssetDigest: string;
  grantDigest: string;
  editOperation: string;
  state: "VERIFIED" | "UNKNOWN" | "CONFLICT" | "PROHIBITED" | "REVOKED";
  checkedAt: string;
  validUntil: string;
}>;

export type ListingGeneratorV2Input = Readonly<{
  subject: Readonly<{ reference: string; evidenceClass: "SYNTHETIC_FIXTURE" | "VERIFIED_PRODUCT" }>;
  generatedAt: string;
  keywordPacket: KeywordIntelligencePacket;
  titlePacket: EvidenceBoundTitleRankingPacket;
  creativePacket: ProductCreativePacket;
  storyPacket: EvidenceBoundPersuasiveStoryPacket;
  detailPagePacket: ConversionDetailPagePacket;
  expectedDigests: Readonly<{
    keyword: string;
    title: string;
    creative: string;
    story: string;
    detailPage: string;
  }>;
  currentPolicy: Readonly<{
    categoryId: string;
    categoryEvidenceDigest: string;
    marketplacePolicyDigest: string;
    state: "APPROVED" | "UNKNOWN" | "CONFLICT" | "PROHIBITED";
    observedAt: string;
    validUntil: string;
  }>;
  currentRights: readonly CurrentRightsAttestation[];
}>;

export type ListingGeneratorV2Packet = Readonly<{
  version: typeof LISTING_GENERATOR_V2_PACKET_VERSION;
  mode: "SHADOW_REVIEW";
  status: "REVIEW_READY";
  executionEligible: false;
  publicationAuthorized: false;
  listingSubmission: null;
  subject: ListingGeneratorV2Input["subject"];
  generatedAt: string;
  predecessorBindings: Readonly<{
    keyword: Readonly<{ version: string; keywordSetVersion: string; digest: string }>;
    title: Readonly<{ version: string; digest: string }>;
    creative: Readonly<{ version: string; digest: string }>;
    story: Readonly<{ version: string; digest: string }>;
    detailPage: Readonly<{ version: string; digest: string }>;
  }>;
  policyBinding: Readonly<{
    categoryId: string;
    categoryEvidenceDigest: string;
    marketplacePolicyDigest: string;
    observedAt: string;
    validUntil: string;
  }>;
  listingDraft: Readonly<{
    title: string;
    keywords: readonly string[];
    renderedDetailHtml: string;
    renderedDetailDigest: string;
    rightsClearedAssets: readonly Readonly<{
      assetId: string;
      reference: string;
      artifactDigest: string;
      sourceAssetDigest: string;
      grantDigest: string;
      editOperation: string;
      altText: string;
    }>[];
  }>;
  competitiveRanking: Readonly<{
    selectedCandidateReference: string;
    score: number;
    scoreBreakdown: Readonly<{
      keywordIntelligence: number;
      titleCompetitiveness: number;
      creativeCompetitiveness: number;
      storyPersuasiveness: number;
      detailConversionReadiness: number;
    }>;
  }>;
  provenance: Readonly<{
    factIds: readonly string[];
    evidenceDigests: readonly string[];
    sourceReferences: readonly string[];
    rights: readonly CurrentRightsAttestation[];
  }>;
  humanReview: Readonly<{
    required: true;
    status: "PENDING";
    instructions: readonly string[];
  }>;
  rollback: Readonly<{
    strategy: "DISCARD_SHADOW_PACKET";
    restorePredecessorDigests: readonly string[];
  }>;
  compatibility: Readonly<{
    existingListingGeneratorUnchanged: true;
    listingServiceUnchanged: true;
    publicApiUnchanged: true;
  }>;
  reviewPacketHtml: string;
  digest: string;
}>;

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_PACKET_AGE_MS = 30 * 86_400_000;

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

function withoutDigest<T extends Readonly<{ digest: string }>>(packet: T): Omit<T, "digest"> {
  const { digest: ignored, ...value } = packet;
  void ignored;
  return value;
}

function assertExactDigest(name: string, packet: Readonly<{ digest: string }>, expected: string): void {
  if (!SHA256.test(expected) || packet.digest !== expected || digest(withoutDigest(packet)) !== expected) {
    throw new Error(`${name}_DIGEST_BINDING_INVALID`);
  }
}

function assertFresh(name: string, observedAt: string, validUntil: string, now: number): void {
  const observed = Date.parse(observedAt);
  const expires = Date.parse(validUntil);
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || observed > now || expires < now) {
    throw new Error(`${name}_STALE`);
  }
}

function assertPacketFresh(name: string, generatedAt: string, now: number): void {
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(generated) || generated > now || now - generated > MAX_PACKET_AGE_MS) throw new Error(`${name}_STALE`);
}

function assertEncodingSafe(name: string, value: string): void {
  if (/\uFFFD|\u0000/.test(value) || /(?:Ã.|Â.|â€|ðŸ)/u.test(value)) throw new Error(`${name}_ENCODING_INVALID`);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/**
 * Composes already-produced, immutable Stage 15A-16B packets. It performs no
 * provider, persistence, publication, marketplace, or commerce operation.
 */
export function buildListingGeneratorV2Packet(input: ListingGeneratorV2Input): ListingGeneratorV2Packet {
  const now = Date.parse(input.generatedAt);
  if (!Number.isFinite(now)) throw new RangeError("generatedAt is invalid.");
  assertExactDigest("KEYWORD_PACKET", input.keywordPacket, input.expectedDigests.keyword);
  assertExactDigest("TITLE_PACKET", input.titlePacket, input.expectedDigests.title);
  assertExactDigest("CREATIVE_PACKET", input.creativePacket, input.expectedDigests.creative);
  assertExactDigest("STORY_PACKET", input.storyPacket, input.expectedDigests.story);
  assertExactDigest("DETAIL_PAGE_PACKET", input.detailPagePacket, input.expectedDigests.detailPage);
  for (const [name, packetGeneratedAt] of [
    ["KEYWORD_PACKET", input.keywordPacket.generatedAt], ["TITLE_PACKET", input.titlePacket.generatedAt],
    ["CREATIVE_PACKET", input.creativePacket.generatedAt], ["STORY_PACKET", input.storyPacket.generatedAt],
    ["DETAIL_PAGE_PACKET", input.detailPagePacket.generatedAt],
  ] as const) assertPacketFresh(name, packetGeneratedAt, now);

  if (input.keywordPacket.status !== "READY" || input.titlePacket.status !== "READY"
      || input.creativePacket.status !== "READY" || input.storyPacket.status !== "READY"
      || !["REVIEW_READY", "APPROVED_SHADOW"].includes(input.detailPagePacket.status)) {
    throw new Error("PREDECESSOR_NOT_REVIEW_READY");
  }
  if (input.titlePacket.keywordPacketDigest !== input.keywordPacket.digest
      || input.titlePacket.keywordSetVersion !== input.keywordPacket.keywordSetVersion) throw new Error("TITLE_KEYWORD_BINDING_INVALID");
  if (input.creativePacket.keywordPacketDigest !== input.keywordPacket.digest
      || input.creativePacket.titlePacketDigest !== input.titlePacket.digest) throw new Error("CREATIVE_TEXT_BINDING_INVALID");
  if (input.storyPacket.keywordPacketDigest !== input.keywordPacket.digest
      || input.storyPacket.titlePacketDigest !== input.titlePacket.digest
      || input.storyPacket.creativePacketDigest !== input.creativePacket.digest) throw new Error("STORY_PREDECESSOR_BINDING_INVALID");
  if (input.detailPagePacket.keywordPacketDigest !== input.keywordPacket.digest
      || input.detailPagePacket.titlePacketDigest !== input.titlePacket.digest
      || input.detailPagePacket.creativePacketDigest !== input.creativePacket.digest
      || input.detailPagePacket.storyPacketDigest !== input.storyPacket.digest) throw new Error("DETAIL_PREDECESSOR_BINDING_INVALID");

  if (input.currentPolicy.state !== "APPROVED") throw new Error(`POLICY_${input.currentPolicy.state}`);
  assertFresh("POLICY", input.currentPolicy.observedAt, input.currentPolicy.validUntil, now);
  assertFresh("CREATIVE_POLICY", input.creativePacket.policySnapshot.observedAt, input.creativePacket.policySnapshot.expiresAt, now);
  if (input.currentPolicy.categoryId !== input.creativePacket.policySnapshot.categoryId
      || input.currentPolicy.categoryId !== input.storyPacket.categoryId
      || input.currentPolicy.categoryEvidenceDigest !== input.creativePacket.policySnapshot.categoryEvidenceDigest
      || input.currentPolicy.categoryEvidenceDigest !== input.storyPacket.creativeBindings.categoryEvidenceDigest
      || input.currentPolicy.categoryEvidenceDigest !== input.detailPagePacket.categoryPolicyDigest
      || input.currentPolicy.marketplacePolicyDigest !== input.creativePacket.policySnapshot.marketplacePolicyDigest
      || input.currentPolicy.marketplacePolicyDigest !== input.storyPacket.creativeBindings.marketplacePolicyDigest
      || input.currentPolicy.marketplacePolicyDigest !== input.detailPagePacket.marketplacePolicyDigest) {
    throw new Error("CURRENT_POLICY_BINDING_INVALID");
  }

  const admittedAssets = input.detailPagePacket.assets;
  const rights = [...input.currentRights].sort((left, right) => left.creativeCandidateId.localeCompare(right.creativeCandidateId));
  for (const asset of admittedAssets) {
    const attestation = rights.find((item) => item.creativeCandidateId === asset.creativeCandidateId
      && item.sourceAssetDigest === asset.sourceAssetDigest && item.grantDigest === asset.grantDigest
      && item.editOperation === asset.editOperation);
    if (!attestation || attestation.state !== "VERIFIED") throw new Error(`CURRENT_RIGHTS_NOT_VERIFIED:${asset.assetId}`);
    assertFresh(`CURRENT_RIGHTS:${asset.assetId}`, attestation.checkedAt, attestation.validUntil, now);
    if (asset.rights !== "VERIFIED" || asset.productAccuracy !== "PASS") throw new Error(`DETAIL_ASSET_NOT_ADMISSIBLE:${asset.assetId}`);
  }

  const title = input.titlePacket.titleCandidates.find((candidate) => candidate.status === "VERIFIED" && candidate.rank === 1);
  const story = input.storyPacket.candidates.find((candidate) => candidate.status === "VERIFIED" && candidate.rank === 1);
  const creative = input.creativePacket.candidates.find((candidate) => candidate.status === "VERIFIED" && candidate.rank === 1);
  const keywords = input.titlePacket.keywordCandidates.filter((candidate) => candidate.status === "VERIFIED").sort((a, b) => a.rank - b.rank);
  const keywordScores = input.keywordPacket.keywords.flatMap((keyword) => keyword.state === "VERIFIED" && keyword.score !== null ? [keyword.score] : []);
  if (!title || title.score === null || !story || story.score === null || !creative || creative.score === null || keywords.length === 0 || keywordScores.length === 0) {
    throw new Error("COMPETITIVE_CANDIDATE_MISSING");
  }
  assertEncodingSafe("TITLE", title.title);
  assertEncodingSafe("DETAIL_PAGE", input.detailPagePacket.html);
  for (const block of input.detailPagePacket.content) for (const sentence of block.sentences) assertEncodingSafe("DETAIL_TEXT", sentence.text);
  const scoreBreakdown = Object.freeze({
    keywordIntelligence: round(keywordScores.reduce((sum, score) => sum + score, 0) / keywordScores.length),
    titleCompetitiveness: title.score,
    creativeCompetitiveness: creative.score,
    storyPersuasiveness: story.score,
    detailConversionReadiness: input.detailPagePacket.conversionReadiness.score,
  });
  const score = round(scoreBreakdown.keywordIntelligence * 0.2 + scoreBreakdown.titleCompetitiveness * 0.2
    + scoreBreakdown.creativeCompetitiveness * 0.2 + scoreBreakdown.storyPersuasiveness * 0.2
    + scoreBreakdown.detailConversionReadiness * 0.2);
  const factIds = [...new Set(input.detailPagePacket.content.flatMap((block) => block.sentences.flatMap((sentence) => sentence.factIds)))].sort();
  const evidenceDigests = [...new Set(input.detailPagePacket.content.flatMap((block) => block.sentences.flatMap((sentence) => sentence.evidenceDigests)))].sort();
  const sourceReferences = [...new Set(input.detailPagePacket.content.flatMap((block) => block.sentences.flatMap((sentence) => sentence.sourceReferences)))].sort();
  const assets = Object.freeze(admittedAssets.map((asset) => Object.freeze({
    assetId: asset.assetId, reference: asset.publicReference, artifactDigest: asset.artifactDigest,
    sourceAssetDigest: asset.sourceAssetDigest, grantDigest: asset.grantDigest,
    editOperation: asset.editOperation, altText: asset.altText,
  })).sort((a, b) => a.assetId.localeCompare(b.assetId)));
  const reviewHeader = `<header data-packet-version="${LISTING_GENERATOR_V2_PACKET_VERSION}"><h1>${escapeHtml(title.title)}</h1><p>SHADOW REVIEW · 경쟁력 ${score}</p></header>`;
  const packetWithoutDigest = {
    version: LISTING_GENERATOR_V2_PACKET_VERSION,
    mode: "SHADOW_REVIEW" as const,
    status: "REVIEW_READY" as const,
    executionEligible: false as const,
    publicationAuthorized: false as const,
    listingSubmission: null,
    subject: Object.freeze({ ...input.subject }),
    generatedAt: new Date(now).toISOString(),
    predecessorBindings: Object.freeze({
      keyword: Object.freeze({ version: input.keywordPacket.version, keywordSetVersion: input.keywordPacket.keywordSetVersion, digest: input.keywordPacket.digest }),
      title: Object.freeze({ version: input.titlePacket.version, digest: input.titlePacket.digest }),
      creative: Object.freeze({ version: input.creativePacket.version, digest: input.creativePacket.digest }),
      story: Object.freeze({ version: input.storyPacket.version, digest: input.storyPacket.digest }),
      detailPage: Object.freeze({ version: input.detailPagePacket.version, digest: input.detailPagePacket.digest }),
    }),
    policyBinding: Object.freeze({ categoryId: input.currentPolicy.categoryId, categoryEvidenceDigest: input.currentPolicy.categoryEvidenceDigest,
      marketplacePolicyDigest: input.currentPolicy.marketplacePolicyDigest, observedAt: input.currentPolicy.observedAt, validUntil: input.currentPolicy.validUntil }),
    listingDraft: Object.freeze({ title: title.title, keywords: Object.freeze(keywords.map(({ keyword }) => keyword)), renderedDetailHtml: input.detailPagePacket.html,
      renderedDetailDigest: input.detailPagePacket.htmlDigest, rightsClearedAssets: assets }),
    competitiveRanking: Object.freeze({ selectedCandidateReference: `${title.title}|${creative.candidateId}|${story.candidateId}`, score, scoreBreakdown }),
    provenance: Object.freeze({ factIds: Object.freeze(factIds), evidenceDigests: Object.freeze(evidenceDigests), sourceReferences: Object.freeze(sourceReferences), rights: Object.freeze(rights) }),
    humanReview: Object.freeze({ required: true as const, status: "PENDING" as const, instructions: Object.freeze(["Verify every fact and visual against the bound provenance.", "Approve or reject this exact packet digest; approval never authorizes publication."]) }),
    rollback: Object.freeze({ strategy: "DISCARD_SHADOW_PACKET" as const, restorePredecessorDigests: Object.freeze(Object.values(input.expectedDigests).sort()) }),
    compatibility: Object.freeze({ existingListingGeneratorUnchanged: true as const, listingServiceUnchanged: true as const, publicApiUnchanged: true as const }),
    reviewPacketHtml: `${reviewHeader}${input.detailPagePacket.html}`,
  };
  return Object.freeze({ ...packetWithoutDigest, digest: digest(packetWithoutDigest) });
}
