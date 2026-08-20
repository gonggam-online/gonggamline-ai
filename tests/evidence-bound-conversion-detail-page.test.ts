import assert from "node:assert/strict";
import test from "node:test";

import { approveConversionDetailPagePacket, buildConversionDetailPagePacket, type DetailPageAsset } from "../shared/domain/evidence-bound-conversion-detail-page.ts";
import { applyHumanStoryRevision, buildEvidenceBoundPersuasiveStoryPacket, STORY_BLOCK_ORDER, type StoryClaim } from "../shared/domain/evidence-bound-persuasive-story.ts";

const digest = (character: string) => character.repeat(64);
const claims: readonly StoryClaim[] = STORY_BLOCK_ORDER.map((blockType, index) => ({
  claimId: `claim-${index}`,
  blockType,
  state: "VERIFIED",
  approvedPhrasings: [`검증된 ${blockType} 문장입니다.`, `승인된 ${blockType} 대체 문장입니다.`],
  factIds: [`fact-${index}`],
  sourceReferences: [`evidence:fixture:${index}`],
  evidenceDigests: [digest("a")],
}));

function approvedStory() {
  const packet = buildEvidenceBoundPersuasiveStoryPacket({
    categoryId: "coupang:kk946",
    storyVersion: "kk946-story-v1",
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4",
    expectedKeywordPacketDigest: "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4",
    titlePacketDigest: digest("b"),
    generatedAt: "2026-08-20T00:00:00.000Z",
    claims,
    personas: [{ personaId: "organizer", label: "정리가 필요한 고객", state: "VERIFIED", evidenceDigests: [digest("a")], intents: ["DISCOVERY", "CONSIDERATION", "PURCHASE"] }],
    objections: [{ objectionId: "faq", personaIds: ["organizer"], intents: ["CONSIDERATION"], questionClaimId: "claim-6", answerClaimIds: ["claim-6"], required: true }],
    policy: { policyVersion: "coupang-policy-v1", categoryEvidenceDigest: digest("c"), marketplacePolicyDigest: digest("d"), forbiddenTerms: [], prohibitedClaimPatterns: [] },
  });
  return applyHumanStoryRevision(packet, { candidateId: packet.candidates[0]?.candidateId ?? "", reviewerReference: "reviewer:story-owner", reviewedAt: "2026-08-20T01:00:00.000Z", selections: [] }, claims);
}

const asset: DetailPageAsset = {
  assetId: "kk946-main",
  artifactDigest: digest("e"),
  approvalDigest: digest("f"),
  role: "MAIN",
  publicReference: "https://assets.invalid/kk946-main.png",
  altText: "검증된 블랙 미니 수납 파우치 정면 이미지",
  factIds: ["fact-2", "fact-5"],
  rights: "VERIFIED",
  productAccuracy: "PASS",
  decode: "PASS",
  encoding: "PASS",
  crop: "PASS",
  mobileSafe: "PASS",
};

function input(overrides: Partial<Parameters<typeof buildConversionDetailPagePacket>[0]> = {}) {
  const story = approvedStory();
  return {
    packageVersion: "kk946-detail-page-v1",
    productReference: "product:kk946",
    title: "블랙 미니 수납 파우치",
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4",
    expectedKeywordPacketDigest: "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4",
    titlePacketDigest: digest("b"),
    expectedTitlePacketDigest: digest("b"),
    story,
    expectedStoryPacketDigest: story.digest,
    categoryPolicyDigest: digest("c"),
    expectedCategoryPolicyDigest: digest("c"),
    marketplacePolicyDigest: digest("d"),
    creativePacketDigest: digest("e"),
    expectedCreativePacketDigest: digest("e"),
    assets: [asset],
    viewportQa: [
      { viewport: "MOBILE_360" as const, renderedWidth: 360, horizontalOverflowPixels: 0, clippedElementCount: 0, minimumBodyFontPixels: 16, unreadableTextCount: 0, brokenImageCount: 0, encodingReplacementCharacterCount: 0 },
      { viewport: "DESKTOP_1280" as const, renderedWidth: 780, horizontalOverflowPixels: 0, clippedElementCount: 0, minimumBodyFontPixels: 16, unreadableTextCount: 0, brokenImageCount: 0, encodingReplacementCharacterCount: 0 },
    ],
    generatedAt: "2026-08-20T02:00:00.000Z",
    ...overrides,
  };
}

test("16B emits renderable versioned HTML/image/content and conversion QA package", () => {
  const packet = buildConversionDetailPagePacket(input());
  assert.equal(packet.status, "REVIEW_READY");
  assert.equal(packet.mode, "SHADOW");
  assert.equal(packet.publicationAuthorized, false);
  assert.equal(packet.listingSubmission, null);
  assert.equal(packet.content.length, 9);
  assert.equal(packet.assets[0]?.altText, asset.altText);
  assert.match(packet.html, /<!doctype html>/);
  assert.match(packet.html, /@media\(max-width:420px\)/);
  assert.equal(packet.previewComparison.responsive, true);
  assert.equal(packet.previewComparison.contentEquivalent, true);
  assert.equal(packet.conversionReadiness.score, 100);
  assert.ok(Object.values(packet.conversionReadiness.breakdown).every((score) => score === 100));
  assert.match(packet.digest, /^[a-f0-9]{64}$/);
});

test("digest drift fails before composition", () => {
  assert.throws(() => buildConversionDetailPagePacket(input({ expectedCreativePacketDigest: digest("0") })), /CREATIVE_PACKET_DIGEST_MISMATCH/);
  assert.throws(() => buildConversionDetailPagePacket(input({ expectedCategoryPolicyDigest: digest("0") })), /CATEGORY_POLICY_PACKET_DIGEST_MISMATCH/);
  assert.throws(() => buildConversionDetailPagePacket(input({ expectedStoryPacketDigest: digest("0") })), /STORY_PACKET_DIGEST_MISMATCH/);
});

test("rights, accuracy, clipping, encoding and legibility failures quarantine only the package", () => {
  const badAsset = { ...asset, rights: "UNKNOWN" as const, productAccuracy: "REVIEW_REQUIRED" as const, encoding: "FAIL" as const };
  const mobile = input().viewportQa[0];
  const packet = buildConversionDetailPagePacket(input({ assets: [badAsset], viewportQa: [{ ...mobile, clippedElementCount: 1, minimumBodyFontPixels: 14, encodingReplacementCharacterCount: 1 }, input().viewportQa[1]] }));
  assert.equal(packet.status, "QUARANTINED");
  assert.ok(packet.conversionReadiness.blockingReasons.includes("ASSET_RIGHTS_UNKNOWN:kk946-main"));
  assert.ok(packet.conversionReadiness.blockingReasons.includes("VIEWPORT_QA_FAILED:MOBILE_360"));
  assert.doesNotMatch(packet.html, /assets\.invalid\/kk946-main\.png/);
  assert.equal(packet.publicationAuthorized, false);
  assert.equal(packet.keywordSetVersion, "kk946-keywords-v1");
});

test("non-HTTPS or copy-unbound assets are quarantined and excluded from render HTML", () => {
  const packet = buildConversionDetailPagePacket(input({ assets: [{ ...asset, publicReference: "data:image/png;base64,abc", factIds: ["unbound-fact"] }] }));
  assert.equal(packet.status, "QUARANTINED");
  assert.ok(packet.conversionReadiness.blockingReasons.includes("ASSET_REFERENCE_NOT_HTTPS:kk946-main"));
  assert.ok(packet.conversionReadiness.blockingReasons.includes("ASSET_COPY_FACT_MISMATCH:kk946-main"));
  assert.doesNotMatch(packet.html, /data:image/);
});

test("packet and preview digests are stable across asset and viewport ordering", () => {
  const extra = { ...asset, assetId: "kk946-detail", role: "DETAIL" as const, artifactDigest: digest("1") };
  const first = buildConversionDetailPagePacket(input({ assets: [asset, extra] }));
  const second = buildConversionDetailPagePacket(input({ assets: [extra, asset], viewportQa: [...input().viewportQa].reverse() }));
  assert.deepEqual(first, second);
});

test("human approval binds the exact packet and remains SHADOW/no-publish", () => {
  const packet = buildConversionDetailPagePacket(input());
  const approved = approveConversionDetailPagePacket(packet, { approvalReference: "approval:16b-owner", reviewerReference: "reviewer:owner", approvedAt: "2026-08-20T03:00:00.000Z", boundPacketDigest: packet.digest });
  assert.equal(approved.status, "APPROVED_SHADOW");
  assert.equal(approved.publicationAuthorized, false);
  assert.equal(approved.listingSubmission, null);
  assert.throws(() => approveConversionDetailPagePacket(packet, { approvalReference: "approval:16b-owner", reviewerReference: "reviewer:owner", approvedAt: "2026-08-20T03:00:00.000Z", boundPacketDigest: digest("0") }), /DETAIL_PAGE_APPROVAL_BINDING_INVALID/);
});

test("HTML escapes approved content and never exposes a commerce-write surface", () => {
  const packet = buildConversionDetailPagePacket(input({ title: "파우치 <script>alert(1)</script>" }));
  assert.doesNotMatch(packet.html, /<script>/);
  assert.match(packet.html, /&lt;script&gt;/);
  assert.equal("price" in packet, false);
  assert.equal("itemSelectionScore" in packet, false);
  assert.equal("publish" in packet, false);
});
