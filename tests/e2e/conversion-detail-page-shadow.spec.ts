import { expect, test } from "@playwright/test";

import { approveConversionDetailPagePacket, buildConversionDetailPagePacket } from "../../shared/domain/evidence-bound-conversion-detail-page";
import { applyHumanStoryRevision, buildEvidenceBoundPersuasiveStoryPacket, STORY_BLOCK_ORDER, type StoryClaim } from "../../shared/domain/evidence-bound-persuasive-story";
import { KEYWORD_INTELLIGENCE_PACKET_VERSION } from "../../shared/domain/competitive-keyword-intelligence";
import { EVIDENCE_BOUND_TITLE_RANKING_VERSION } from "../../shared/domain/evidence-bound-title-ranking";
import { buildStoryCreativeFixture, STORY_FIXTURE_CREATIVE_DIGEST, STORY_FIXTURE_KEYWORD_DIGEST, STORY_FIXTURE_TITLE_DIGEST } from "../fixtures/product-creative/story-creative-fixture";

const digest = (character: string) => character.repeat(64);

function approvedShadowPacket() {
  const claims: readonly StoryClaim[] = STORY_BLOCK_ORDER.map((blockType, index) => ({
    claimId: `claim-${index}`,
    blockType,
    state: "VERIFIED",
    approvedPhrasings: [`검증된 ${blockType} 상세 정보입니다.`],
    factIds: [`fact-${index}`],
    sourceReferences: [`evidence:e2e:${index}`],
    evidenceDigests: [digest("a")],
    observedAt: "2026-08-19T00:00:00.000Z",
    validUntil: "2026-09-20T00:00:00.000Z",
  }));
  const story = buildEvidenceBoundPersuasiveStoryPacket({
    categoryId: "coupang:pouch",
    storyVersion: "kk946-story-v1",
    keywordPacketVersion: KEYWORD_INTELLIGENCE_PACKET_VERSION,
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: STORY_FIXTURE_KEYWORD_DIGEST,
    expectedKeywordPacketDigest: STORY_FIXTURE_KEYWORD_DIGEST,
    titlePacketVersion: EVIDENCE_BOUND_TITLE_RANKING_VERSION,
    titlePacketDigest: STORY_FIXTURE_TITLE_DIGEST,
    expectedTitlePacketDigest: STORY_FIXTURE_TITLE_DIGEST,
    creativePacket: buildStoryCreativeFixture(),
    expectedCreativePacketDigest: STORY_FIXTURE_CREATIVE_DIGEST,
    generatedAt: "2026-08-20T00:00:00.000Z",
    claims,
    personas: [{ personaId: "organizer", label: "정리가 필요한 고객", state: "VERIFIED", evidenceDigests: [digest("a")], intents: ["DISCOVERY", "CONSIDERATION", "PURCHASE"], observedAt: "2026-08-19T00:00:00.000Z", validUntil: "2026-09-20T00:00:00.000Z" }],
    objections: [{ objectionId: "faq", personaIds: ["organizer"], intents: ["CONSIDERATION"], questionClaimId: "claim-6", answerClaimIds: ["claim-6"], required: true }],
    policy: { policyVersion: "coupang-policy-v1", categoryEvidenceDigest: digest("f"), marketplacePolicyDigest: digest("1"), forbiddenTerms: [], prohibitedClaimPatterns: [] },
  });
  const revisedStory = applyHumanStoryRevision(story, { candidateId: story.candidates[0]?.candidateId ?? "", reviewerReference: "reviewer:story-owner", reviewedAt: "2026-08-20T01:00:00.000Z", selections: [] }, claims);
  const packet = buildConversionDetailPagePacket({
    packageVersion: "kk946-detail-page-v1",
    productReference: "product:kk946",
    title: "블랙 미니 수납 파우치",
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4",
    expectedKeywordPacketDigest: "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4",
    titlePacketDigest: digest("b"),
    expectedTitlePacketDigest: digest("b"),
    story: revisedStory,
    expectedStoryPacketDigest: revisedStory.digest,
    categoryPolicyDigest: digest("c"),
    expectedCategoryPolicyDigest: digest("c"),
    marketplacePolicyDigest: digest("d"),
    creativePacketDigest: digest("e"),
    expectedCreativePacketDigest: digest("e"),
    assets: [{ assetId: "kk946-main", artifactDigest: digest("e"), approvalDigest: digest("f"), role: "MAIN", publicReference: "https://assets.invalid/kk946-main.png", altText: "검증된 블랙 미니 수납 파우치 정면 이미지", factIds: ["fact-2"], rights: "VERIFIED", productAccuracy: "PASS", decode: "PASS", encoding: "PASS", crop: "PASS", mobileSafe: "PASS" }],
    viewportQa: [
      { viewport: "MOBILE_360", renderedWidth: 360, horizontalOverflowPixels: 0, clippedElementCount: 0, minimumBodyFontPixels: 16, unreadableTextCount: 0, brokenImageCount: 0, encodingReplacementCharacterCount: 0 },
      { viewport: "DESKTOP_1280", renderedWidth: 780, horizontalOverflowPixels: 0, clippedElementCount: 0, minimumBodyFontPixels: 16, unreadableTextCount: 0, brokenImageCount: 0, encodingReplacementCharacterCount: 0 },
    ],
    generatedAt: "2026-08-20T02:00:00.000Z",
  });
  return approveConversionDetailPagePacket(packet, { approvalReference: "approval:16b-e2e", reviewerReference: "reviewer:owner", approvedAt: "2026-08-20T03:00:00.000Z", boundPacketDigest: packet.digest });
}

test("approved 16B package renders legibly at mobile and desktop without publish requests", async ({ page }) => {
  const packet = approvedShadowPacket();
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writeRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.route("https://assets.invalid/**", async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));

  for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.setContent(packet.html, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("블랙 미니 수납 파우치");
    await expect(page.locator("main.detail section")).toHaveCount(9);
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyFont: Number.parseFloat(getComputedStyle(document.body).fontSize),
      replacementCharacters: (document.body.textContent?.match(/�/g) ?? []).length,
      brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length,
    }));
    expect(metrics).toEqual({ overflow: 0, bodyFont: 16, replacementCharacters: 0, brokenImages: 0 });
  }
  expect(packet.status).toBe("APPROVED_SHADOW");
  expect(packet.publicationAuthorized).toBe(false);
  expect(packet.listingSubmission).toBeNull();
  expect(writeRequests).toEqual([]);
});
