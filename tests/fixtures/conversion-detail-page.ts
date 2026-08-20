import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DetailPageAsset } from "../../shared/domain/evidence-bound-conversion-detail-page.ts";
import { buildProductCreativePacket, type CreativeAssetEvidence } from "../../shared/domain/evidence-bound-product-creative.ts";
import { buildEvidenceBoundPersuasiveStoryPacket, STORY_BLOCK_ORDER, type StoryClaim } from "../../shared/domain/evidence-bound-persuasive-story.ts";
import { KEYWORD_INTELLIGENCE_PACKET_VERSION } from "../../shared/domain/competitive-keyword-intelligence.ts";
import { EVIDENCE_BOUND_TITLE_RANKING_VERSION } from "../../shared/domain/evidence-bound-title-ranking.ts";

export const STORY_DIGEST = "22a38251b9ddf256d7d06d519f10df0383b289ecf1395f16a66df50e6bda4a3c";
const KEYWORD_DIGEST = "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4";
const TITLE_DIGEST = "7a71c429c203961be4eb6c6b35bfcf3731d0143e04add7af07bc43df1e8f5c22";
const CREATIVE_DIGEST = "3c73e2d0b8664f02db80f759f69a7f0fd2f07c1deecbca9794f00d1e9558e8dd";
const EVIDENCE_DIGEST = "a".repeat(64);
const PHRASING: Record<(typeof STORY_BLOCK_ORDER)[number], readonly [string, string]> = {
  PROBLEM_CONTEXT: ["흩어진 충전기와 케이블을 한곳에 정리해야 하는 상황입니다.", "충전기와 케이블이 흩어지는 상황을 정리해 보세요."],
  EMPATHY: ["작은 전자기기를 찾기 어려운 순간을 고려했습니다.", "필요할 때 작은 전자기기를 찾는 번거로움을 고려했습니다."],
  SOLUTION: ["미니 파우치에 충전기와 케이블을 수납할 수 있습니다.", "충전기와 케이블 수납용 미니 파우치입니다."],
  CORE_BENEFIT: ["10.5 × 3.6 × 6.5 cm 크기의 수납 공간을 제공합니다.", "기록된 크기는 10.5 × 3.6 × 6.5 cm입니다."],
  USE_SCENE: ["충전기와 케이블을 함께 보관하는 장면에 사용할 수 있습니다.", "전자기기 부속품 보관에 사용할 수 있습니다."],
  CONTENTS_USAGE: ["블랙 미니 파우치 1개 구성입니다.", "구성은 블랙 미니 파우치 1개입니다."],
  OBJECTIONS_FAQ: ["생산 시기에 따라 색상 차이가 있을 수 있습니다.", "색상 차이 가능성을 구매 전에 확인해 주세요."],
  TRUST_NOTICE: ["제조국 표기는 중국 OEM입니다.", "제조국 정보는 중국 OEM으로 표기됩니다."],
  CTA: ["구성과 크기를 확인한 뒤 선택해 주세요.", "구성 및 크기를 확인하고 선택해 주세요."],
};

function storyPacket() {
  const assets = JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/product-creative/kk946-rights-cleared-assets-v1.json"), "utf8")) as readonly CreativeAssetEvidence[];
  const creative = buildProductCreativePacket({ candidateId: "KK946", generatedAt: "2026-08-20T00:00:00.000Z", keywordSetVersion: "kk946-keywords-v1", keywordPacketDigest: KEYWORD_DIGEST, expectedKeywordPacketDigest: KEYWORD_DIGEST, keywordRelevanceScore: 100, titlePacketDigest: TITLE_DIGEST, expectedTitlePacketDigest: TITLE_DIGEST, policySnapshot: { policyVersion: "coupang-category-image-policy-v1", categoryId: "coupang:pouch", state: "APPROVED", categoryEvidenceDigest: "f".repeat(64), marketplacePolicyDigest: "1".repeat(64), observedAt: "2026-08-19T00:00:00.000Z", expiresAt: "2026-09-20T00:00:00.000Z", allowedOperations: ["ORIGINAL_USE", "CROP_SQUARE", "BACKGROUND_REMOVE", "BRIGHTNESS_ADJUST"], minProductCoveragePercent: 70, maxProductCoveragePercent: 95 }, assets });
  if (creative.digest !== CREATIVE_DIGEST) throw new Error("FIXTURE_CREATIVE_DIGEST_DRIFT");
  const claims: readonly StoryClaim[] = STORY_BLOCK_ORDER.map((blockType, index) => ({ claimId: `claim-${index}`, blockType, state: "VERIFIED", approvedPhrasings: PHRASING[blockType], factIds: [`fact-${index}`], sourceReferences: [`evidence:fixture:${index}`], evidenceDigests: [EVIDENCE_DIGEST], observedAt: "2026-08-19T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" }));
  return buildEvidenceBoundPersuasiveStoryPacket({ categoryId: "coupang:pouch", storyVersion: "kk946-story-v1", keywordPacketVersion: KEYWORD_INTELLIGENCE_PACKET_VERSION, keywordSetVersion: "kk946-keywords-v1", keywordPacketDigest: KEYWORD_DIGEST, expectedKeywordPacketDigest: KEYWORD_DIGEST, titlePacketVersion: EVIDENCE_BOUND_TITLE_RANKING_VERSION, titlePacketDigest: TITLE_DIGEST, expectedTitlePacketDigest: TITLE_DIGEST, creativePacket: creative, expectedCreativePacketDigest: CREATIVE_DIGEST, generatedAt: "2026-08-20T00:00:00.000Z", claims, personas: [{ personaId: "cable-organizer", label: "충전기·케이블 정리가 필요한 고객", state: "VERIFIED", evidenceDigests: [EVIDENCE_DIGEST], intents: ["DISCOVERY", "CONSIDERATION", "PURCHASE"], observedAt: "2026-08-19T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" }], objections: [{ objectionId: "color-variance", personaIds: ["cable-organizer"], intents: ["CONSIDERATION"], questionClaimId: "claim-6", answerClaimIds: ["claim-6"], required: true }], policy: { policyVersion: "coupang-policy-v1", categoryEvidenceDigest: "f".repeat(64), marketplacePolicyDigest: "1".repeat(64), forbiddenTerms: ["완치"], prohibitedClaimPatterns: ["최고|100%\\s*보장"] } });
}

export const DETAIL_FIXTURE_ASSET: DetailPageAsset = Object.freeze({ assetId: "kk946-main", creativeCandidateId: "kk946-front-photo:crop_square", artifactDigest: "2".repeat(64), approvalDigest: "3".repeat(64), sourceAssetDigest: "a".repeat(64), grantDigest: "b".repeat(64), editOperation: "CROP_SQUARE", role: "MAIN", publicReference: "https://assets.invalid/kk946-main.png", altText: "synthetic black pouch front fixture image", factIds: ["fact-2"], rights: "VERIFIED", productAccuracy: "PASS", decode: "PASS", encoding: "PASS", crop: "PASS", mobileSafe: "PASS" });

export function buildConversionDetailPageFixtureInput(overrides: Record<string, unknown> = {}) {
  const story = storyPacket();
  if (story.digest !== STORY_DIGEST) throw new Error(`FIXTURE_STORY_DIGEST_DRIFT:${story.digest}`);
  return { packageVersion: "synthetic-detail-page-v2", productReference: "fixture:product", title: "Synthetic fixture pouch", keywordSetVersion: "kk946-keywords-v1", keywordPacketDigest: KEYWORD_DIGEST, expectedKeywordPacketDigest: KEYWORD_DIGEST, titlePacketDigest: TITLE_DIGEST, expectedTitlePacketDigest: TITLE_DIGEST, story, expectedStoryPacketDigest: STORY_DIGEST, categoryPolicyDigest: "f".repeat(64), expectedCategoryPolicyDigest: "f".repeat(64), marketplacePolicyDigest: "1".repeat(64), creativePacketDigest: CREATIVE_DIGEST, expectedCreativePacketDigest: CREATIVE_DIGEST, assets: [DETAIL_FIXTURE_ASSET], viewportQa: [{ viewport: "MOBILE_360" as const, renderedWidth: 360, horizontalOverflowPixels: 0, clippedElementCount: 0, minimumBodyFontPixels: 16, unreadableTextCount: 0, brokenImageCount: 0, encodingReplacementCharacterCount: 0 }, { viewport: "DESKTOP_1280" as const, renderedWidth: 780, horizontalOverflowPixels: 0, clippedElementCount: 0, minimumBodyFontPixels: 16, unreadableTextCount: 0, brokenImageCount: 0, encodingReplacementCharacterCount: 0 }], generatedAt: "2026-08-20T02:00:00.000Z", ...overrides };
}
