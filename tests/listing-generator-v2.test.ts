import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildListingGeneratorV2Packet } from "../shared/domain/listing-generator-v2.ts";
import type { KeywordIntelligencePacket } from "../shared/domain/competitive-keyword-intelligence.ts";
import type { ConversionDetailPagePacket } from "../shared/domain/evidence-bound-conversion-detail-page.ts";
import type { ProductCreativePacket } from "../shared/domain/evidence-bound-product-creative.ts";
import type { EvidenceBoundPersuasiveStoryPacket } from "../shared/domain/evidence-bound-persuasive-story.ts";
import type { EvidenceBoundTitleRankingPacket } from "../shared/domain/evidence-bound-title-ranking.ts";

const hash = (character: string) => character.repeat(64);
const generatedAt = "2026-08-20T04:00:00.000Z";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key.normalize("NFC"))}:${canonicalJson(item)}`).join(",")}}`;
}

function seal<T extends object>(value: T): T & Readonly<{ digest: string }> {
  return Object.freeze({ ...value, digest: createHash("sha256").update(canonicalJson(value), "utf8").digest("hex") });
}

function fixture() {
  const keywordPacket = seal({
    version: "gonggamline-competitive-keyword-intelligence-v1", keywordSetVersion: "synthetic-keywords-v1",
    candidateId: "SYNTHETIC-P001", mode: "SHADOW", status: "READY", generatedAt,
    keywords: [{ canonical: "정리 파우치", variants: ["정리 파우치"], kinds: ["CORE"], state: "VERIFIED", score: 82,
      scoreBreakdown: { demand: 80, competitionOpportunity: 75, trend: 80, contentGap: 85, profitability: 80, relevance: 100, confidence: 90 },
      evidence: [{ provider: "NAVER", sourceReference: "https://evidence.invalid/keyword", observedAt: generatedAt, freshness: "FRESH", evidenceDigest: hash("1") }], exclusionReasons: [] }],
    exclusions: [],
  } as const) as KeywordIntelligencePacket;
  const titlePacket = seal({
    version: "gonggamline-evidence-bound-title-ranking-v1", keywordSetVersion: keywordPacket.keywordSetVersion,
    keywordPacketDigest: keywordPacket.digest, candidateId: "SYNTHETIC-P001", mode: "SHADOW", status: "READY", executionEligible: false, generatedAt,
    titleCandidates: [{ title: "정리 파우치 합성 샘플", rank: 1, status: "VERIFIED", score: 88,
      scoreBreakdown: { relevance: 90, purchaseIntent: 85, readability: 90, evidence: 100, policy: 100 },
      provenance: { factIds: ["fact:synthetic-product"], keywordSetVersion: keywordPacket.keywordSetVersion, keywordEvidenceDigests: [hash("1")] }, exclusionReasons: [] }],
    keywordCandidates: [{ keyword: "정리 파우치", rank: 1, status: "VERIFIED", score: 82,
      provenance: { keywordSetVersion: keywordPacket.keywordSetVersion, keywordEvidenceDigests: [hash("1")] }, exclusionReasons: [] }],
  } as const) as EvidenceBoundTitleRankingPacket;
  const creativePacket = seal({
    version: "gonggamline-evidence-bound-product-creative-v1", candidateId: "SYNTHETIC-P001", mode: "SHADOW", status: "READY", executionEligible: false, generatedAt,
    keywordSetVersion: keywordPacket.keywordSetVersion, keywordPacketDigest: keywordPacket.digest, titlePacketDigest: titlePacket.digest,
    policySnapshot: { policyVersion: "synthetic-policy-v1", categoryId: "synthetic:organizer", state: "APPROVED", categoryEvidenceDigest: hash("2"), marketplacePolicyDigest: hash("3"), observedAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-09-20T00:00:00.000Z", allowedOperations: ["CROP_SQUARE"], minProductCoveragePercent: 70, maxProductCoveragePercent: 95 },
    policyBindings: { assetRightsPolicyDigest: "cb06faeb826d3fc3e51c12b4faf5d3c9123d1258670f253b242671fcfd6921c0", assetErrorIsolationPolicyDigest: "cb2c15f8973586df4dc7ae1d022568901beaf54822743e3c36b704fc7728ed1c" },
    assetManifest: [{ assetId: "asset:synthetic", assetDigest: hash("4"), state: "ELIGIBLE", allowedOperations: ["CROP_SQUARE"], exclusionReasons: [] }],
    candidates: [{ candidateId: "asset:synthetic:crop", assetId: "asset:synthetic", rank: 1, status: "VERIFIED", operation: "CROP_SQUARE", brief: "합성 fixture 정사각형 검토 렌더", score: 91,
      scoreBreakdown: { productIdentity: 100, keywordRelevance: 90, policyCompliance: 100, visualClarity: 90, conversionUsefulness: 85, rightsProvenance: 100 },
      provenance: { sourceAssetDigest: hash("4"), grantDigest: hash("5"), productFactIds: ["fact:synthetic-product"], keywordPacketDigest: keywordPacket.digest, titlePacketDigest: titlePacket.digest, categoryEvidenceDigest: hash("2"), marketplacePolicyDigest: hash("3"), transformation: { operation: "CROP_SQUARE", changesProductFacts: false } }, exclusionReasons: [] }],
    quarantinedAssetIds: [], humanReview: { required: true, status: "PENDING", selectedCandidateId: null, reviewerReference: null, reviewedAt: null }, rollback: { strategy: "DISCARD_SHADOW_PACKET", sourceAssetDigests: [hash("4")] },
  } as const) as ProductCreativePacket;
  const storyPacket = seal({
    version: "gonggamline-evidence-bound-persuasive-story-v2", categoryId: "synthetic:organizer", storyVersion: "synthetic-story-v1",
    keywordPacketVersion: keywordPacket.version, keywordSetVersion: keywordPacket.keywordSetVersion, keywordPacketDigest: keywordPacket.digest,
    titlePacketVersion: titlePacket.version, titlePacketDigest: titlePacket.digest, creativePacketVersion: creativePacket.version, creativePacketDigest: creativePacket.digest,
    creativeBindings: { candidateIds: ["asset:synthetic:crop"], assetDigests: [hash("4")], grantDigests: [hash("5")], operations: ["CROP_SQUARE"], categoryEvidenceDigest: hash("2"), marketplacePolicyDigest: hash("3") },
    claimSetDigest: hash("6"), mode: "SHADOW", status: "READY", executionEligible: false, generatedAt,
    candidates: [{ candidateId: "synthetic:organizer:consideration", rank: 1, status: "VERIFIED", score: 90,
      scoreBreakdown: { blockCoverage: 100, personaIntentCoverage: 100, objectionCoverage: 100, provenanceCoverage: 100, policy: 100, creativeEvidence: 90 },
      blocks: [{ blockId: "block:synthetic", blockType: "SOLUTION", version: "v1", personaIds: ["persona:synthetic"], intents: ["PURCHASE"], objectionIds: [], creativeCandidateIds: ["asset:synthetic:crop"], sentences: [{ sentenceId: "sentence:synthetic", text: "검증된 합성 fixture 문장입니다.", claimId: "claim:synthetic", phrasingIndex: 0, provenance: { factIds: ["fact:synthetic-product"], sourceReferences: ["evidence:synthetic:product"], evidenceDigests: [hash("7")] } }] }],
      coveredObjectionIds: [], exclusionReasons: [] }], quarantinedClaimIds: [], humanRevision: null,
  } as const) as EvidenceBoundPersuasiveStoryPacket;
  const detailPagePacket = seal({
    version: "gonggamline-evidence-bound-conversion-detail-page-v2", packageVersion: "synthetic-detail-v1", mode: "SHADOW", executionEligible: false, status: "REVIEW_READY", publicationAuthorized: false, listingSubmission: null,
    productReference: "SYNTHETIC-P001", title: "정리 파우치 합성 샘플", keywordSetVersion: keywordPacket.keywordSetVersion,
    keywordPacketDigest: keywordPacket.digest, titlePacketDigest: titlePacket.digest, storyPacketDigest: storyPacket.digest,
    categoryPolicyDigest: hash("2"), marketplacePolicyDigest: hash("3"), creativePacketDigest: creativePacket.digest,
    assetSetDigest: hash("8"), blockSetDigest: hash("9"), generatedAt, html: "<article><h2>합성 검토 페이지</h2><p>검증된 합성 fixture 문장입니다.</p></article>", htmlDigest: hash("a"),
    content: [{ blockType: "SOLUTION", heading: "정리 방법", sentences: [{ text: "검증된 합성 fixture 문장입니다.", claimId: "claim:synthetic", factIds: ["fact:synthetic-product"], sourceReferences: ["evidence:synthetic:product"], evidenceDigests: [hash("7")] }] }],
    assets: [{ assetId: "render:synthetic", creativeCandidateId: "asset:synthetic:crop", artifactDigest: hash("b"), approvalDigest: hash("c"), sourceAssetDigest: hash("4"), grantDigest: hash("5"), editOperation: "CROP_SQUARE", role: "MAIN", publicReference: "https://assets.invalid/synthetic.png", altText: "합성 정리 파우치 검토 이미지", factIds: ["fact:synthetic-product"], rights: "VERIFIED", productAccuracy: "PASS", decode: "PASS", encoding: "PASS", crop: "PASS", mobileSafe: "PASS" }],
    viewportQa: [], previewComparison: { mobileDigest: hash("d"), desktopDigest: hash("e"), contentEquivalent: true, responsive: true },
    conversionReadiness: { score: 94, breakdown: { aboveTheFold: 100, mobileScanability: 90, informationHierarchy: 90, imageCopyConsistency: 100, trustFaqNotice: 90, callToAction: 90, provenance: 100, policyAndRights: 100 }, blockingReasons: [] }, humanApproval: null,
  } as const) as ConversionDetailPagePacket;
  const expectedDigests = { keyword: keywordPacket.digest, title: titlePacket.digest, creative: creativePacket.digest, story: storyPacket.digest, detailPage: detailPagePacket.digest };
  return { keywordPacket, titlePacket, creativePacket, storyPacket, detailPagePacket, expectedDigests };
}

export function listingGeneratorV2FixtureInput() {
  const packets = fixture();
  return { ...packets, subject: { reference: "SYNTHETIC-P001", evidenceClass: "SYNTHETIC_FIXTURE" as const }, generatedAt,
    currentPolicy: { categoryId: "synthetic:organizer", categoryEvidenceDigest: hash("2"), marketplacePolicyDigest: hash("3"), state: "APPROVED" as const, observedAt: "2026-08-20T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" },
    currentRights: [{ creativeCandidateId: "asset:synthetic:crop", sourceAssetDigest: hash("4"), grantDigest: hash("5"), editOperation: "CROP_SQUARE", state: "VERIFIED" as const, checkedAt: "2026-08-20T03:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" }] };
}

test("Listing Generator v2 composes all five exact packets into a deterministic rendered review packet", () => {
  const first = buildListingGeneratorV2Packet(listingGeneratorV2FixtureInput());
  const second = buildListingGeneratorV2Packet(listingGeneratorV2FixtureInput());
  assert.deepEqual(first, second);
  assert.equal(first.version, "gonggamline-listing-generator-v2-competitive-review-v1");
  assert.equal(first.mode, "SHADOW_REVIEW");
  assert.equal(first.executionEligible, false);
  assert.equal(first.publicationAuthorized, false);
  assert.equal(first.listingSubmission, null);
  assert.equal(first.listingDraft.title, "정리 파우치 합성 샘플");
  assert.equal(first.listingDraft.rightsClearedAssets.length, 1);
  assert.deepEqual(Object.keys(first.predecessorBindings), ["keyword", "title", "creative", "story", "detailPage"]);
  assert.deepEqual(first.competitiveRanking.scoreBreakdown, { keywordIntelligence: 82, titleCompetitiveness: 88, creativeCompetitiveness: 91, storyPersuasiveness: 90, detailConversionReadiness: 94 });
  assert.equal(first.competitiveRanking.score, 89);
  assert.match(first.reviewPacketHtml, /합성 검토 페이지/);
  assert.equal(first.digest, "e5e69b5e9903d3a6ca5012d8840a8cebc611ca8346edf16591c7b4c0590f5306");
});

test("digest, policy, rights and predecessor drift fail closed", () => {
  const valid = listingGeneratorV2FixtureInput();
  assert.throws(() => buildListingGeneratorV2Packet({ ...valid, expectedDigests: { ...valid.expectedDigests, title: hash("0") } }), /TITLE_PACKET_DIGEST_BINDING_INVALID/);
  assert.throws(() => buildListingGeneratorV2Packet({ ...valid, currentPolicy: { ...valid.currentPolicy, marketplacePolicyDigest: hash("0") } }), /CURRENT_POLICY_BINDING_INVALID/);
  assert.throws(() => buildListingGeneratorV2Packet({ ...valid, currentRights: [{ ...valid.currentRights[0], state: "REVOKED" }] }), /CURRENT_RIGHTS_NOT_VERIFIED/);
  assert.throws(() => buildListingGeneratorV2Packet({ ...valid, currentRights: [{ ...valid.currentRights[0], validUntil: "2026-08-19T00:00:00.000Z" }] }), /CURRENT_RIGHTS:render:synthetic_STALE/);
  assert.throws(() => buildListingGeneratorV2Packet({ ...valid, generatedAt: "2026-10-21T00:00:00.000Z" }), /KEYWORD_PACKET_STALE/);
});

test("packet exposes review and rollback metadata without legacy or Item Selection mutation surfaces", () => {
  const packet = buildListingGeneratorV2Packet(listingGeneratorV2FixtureInput());
  assert.equal(packet.humanReview.required, true);
  assert.equal(packet.humanReview.status, "PENDING");
  assert.equal(packet.rollback.strategy, "DISCARD_SHADOW_PACKET");
  assert.deepEqual(packet.compatibility, { existingListingGeneratorUnchanged: true, listingServiceUnchanged: true, publicApiUnchanged: true });
  for (const forbidden of ["itemSelectionScore", "recommendation", "price", "provider", "upload", "publish"]) assert.equal(forbidden in packet, false);
});
