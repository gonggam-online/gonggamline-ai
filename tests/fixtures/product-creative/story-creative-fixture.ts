import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildProductCreativePacket,
  type CreativeAssetEvidence,
} from "../../../shared/domain/evidence-bound-product-creative.ts";

export const STORY_FIXTURE_KEYWORD_DIGEST = "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4";
export const STORY_FIXTURE_TITLE_DIGEST = "7a71c429c203961be4eb6c6b35bfcf3731d0143e04add7af07bc43df1e8f5c22";
export const STORY_FIXTURE_CREATIVE_DIGEST = "3c73e2d0b8664f02db80f759f69a7f0fd2f07c1deecbca9794f00d1e9558e8dd";

export function buildStoryCreativeFixture() {
  const assets = JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/product-creative/kk946-rights-cleared-assets-v1.json"), "utf8")) as readonly CreativeAssetEvidence[];
  return buildProductCreativePacket({
    candidateId: "KK946",
    generatedAt: "2026-08-20T00:00:00.000Z",
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: STORY_FIXTURE_KEYWORD_DIGEST,
    expectedKeywordPacketDigest: STORY_FIXTURE_KEYWORD_DIGEST,
    keywordRelevanceScore: 100,
    titlePacketDigest: STORY_FIXTURE_TITLE_DIGEST,
    expectedTitlePacketDigest: STORY_FIXTURE_TITLE_DIGEST,
    policySnapshot: {
      policyVersion: "coupang-category-image-policy-v1",
      categoryId: "coupang:pouch",
      state: "APPROVED",
      categoryEvidenceDigest: "f".repeat(64),
      marketplacePolicyDigest: "1".repeat(64),
      observedAt: "2026-08-19T00:00:00.000Z",
      expiresAt: "2026-09-20T00:00:00.000Z",
      allowedOperations: ["ORIGINAL_USE", "CROP_SQUARE", "BACKGROUND_REMOVE", "BRIGHTNESS_ADJUST"],
      minProductCoveragePercent: 70,
      maxProductCoveragePercent: 95,
    },
    assets,
  });
}
