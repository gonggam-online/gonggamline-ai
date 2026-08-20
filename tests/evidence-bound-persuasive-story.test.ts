import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHumanStoryRevision,
  buildEvidenceBoundPersuasiveStoryPacket,
  STORY_BLOCK_ORDER,
  type StoryClaim,
} from "../shared/domain/evidence-bound-persuasive-story.ts";

const digest = "a".repeat(64);
const keywordDigest = "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4";

const phrasing: Record<(typeof STORY_BLOCK_ORDER)[number], readonly [string, string]> = {
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

const claims: readonly StoryClaim[] = STORY_BLOCK_ORDER.map((blockType, index) => ({
  claimId: `claim-${index}`,
  blockType,
  state: "VERIFIED",
  approvedPhrasings: phrasing[blockType],
  factIds: [`fact-${index}`],
  sourceReferences: [`evidence:fixture:${index}`],
  evidenceDigests: [digest],
}));

function input(overrides: Partial<Parameters<typeof buildEvidenceBoundPersuasiveStoryPacket>[0]> = {}) {
  return {
    categoryId: "coupang:pouch",
    storyVersion: "kk946-story-v1",
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: keywordDigest,
    expectedKeywordPacketDigest: keywordDigest,
    titlePacketDigest: "b".repeat(64),
    generatedAt: "2026-08-20T00:00:00.000Z",
    claims,
    personas: [{ personaId: "cable-organizer", label: "충전기·케이블 정리가 필요한 고객", state: "VERIFIED" as const, evidenceDigests: [digest], intents: ["DISCOVERY", "CONSIDERATION", "PURCHASE"] as const }],
    objections: [{ objectionId: "color-variance", personaIds: ["cable-organizer"], intents: ["CONSIDERATION"] as const, questionClaimId: "claim-6", answerClaimIds: ["claim-6"], required: true }],
    policy: { policyVersion: "coupang-policy-v1", categoryEvidenceDigest: "c".repeat(64), marketplacePolicyDigest: "d".repeat(64), forbiddenTerms: ["완치"], prohibitedClaimPatterns: ["최고|100%\\s*보장"] },
    ...overrides,
  };
}

test("16A emits ranked versioned Shadow-only blocks with sentence provenance and mappings", () => {
  const packet = buildEvidenceBoundPersuasiveStoryPacket(input());
  assert.equal(packet.status, "READY");
  assert.equal(packet.mode, "SHADOW");
  assert.equal(packet.executionEligible, false);
  assert.equal(packet.keywordSetVersion, "kk946-keywords-v1");
  assert.equal(packet.keywordPacketDigest, keywordDigest);
  assert.deepEqual(packet.candidates[0]?.blocks.map(({ blockType }) => blockType), STORY_BLOCK_ORDER);
  assert.ok(packet.candidates.every(({ blocks }) => blocks.every(({ personaIds, intents, sentences }) => personaIds.length === 1 && intents.length === 3 && sentences.every(({ provenance }) => provenance.factIds.length > 0))));
  assert.deepEqual(packet.candidates[0]?.coveredObjectionIds, ["color-variance"]);
  assert.match(packet.digest, /^[a-f0-9]{64}$/);
});

test("UNKNOWN, CONFLICT, PROHIBITED and invented prohibited language fail closed", () => {
  for (const state of ["UNKNOWN", "CONFLICT", "PROHIBITED"] as const) {
    const changed = claims.map((claim, index) => index === 0 ? { ...claim, state } : claim);
    const packet = buildEvidenceBoundPersuasiveStoryPacket(input({ claims: changed }));
    assert.equal(packet.status, "QUARANTINED");
    assert.deepEqual(packet.quarantinedClaimIds, ["claim-0"]);
    assert.ok(packet.candidates.every(({ exclusionReasons }) => exclusionReasons.includes("BLOCK_MISSING:PROBLEM_CONTEXT")));
  }
  const prohibited = claims.map((claim, index) => index === 3 ? { ...claim, approvedPhrasings: ["최고의 수납 효과를 100% 보장합니다."] } : claim);
  const packet = buildEvidenceBoundPersuasiveStoryPacket(input({ claims: prohibited }));
  assert.equal(packet.status, "QUARANTINED");
  assert.deepEqual(packet.quarantinedClaimIds, ["claim-3"]);
});

test("digest drift and unverified persona/objection coverage are rejected or quarantined", () => {
  assert.throws(() => buildEvidenceBoundPersuasiveStoryPacket(input({ expectedKeywordPacketDigest: "0".repeat(64) })), /KEYWORD_PACKET_DIGEST_MISMATCH/);
  const packet = buildEvidenceBoundPersuasiveStoryPacket(input({ personas: [{ ...input().personas[0], state: "UNKNOWN" }] }));
  assert.equal(packet.status, "QUARANTINED");
  assert.ok(packet.candidates.every(({ exclusionReasons }) => exclusionReasons.includes("VERIFIED_PERSONA_MISSING") && exclusionReasons.includes("OBJECTION_PERSONA_UNVERIFIED:color-variance")));
});

test("candidate ranking and digest are deterministic across input ordering", () => {
  const first = buildEvidenceBoundPersuasiveStoryPacket(input());
  const second = buildEvidenceBoundPersuasiveStoryPacket(input({ claims: [...claims].reverse() }));
  assert.deepEqual(first, second);
  assert.equal(first.candidates[0]?.candidateId, "coupang:pouch:consideration");
});

test("human revision can select only pre-approved evidence-bound phrasing", () => {
  const packet = buildEvidenceBoundPersuasiveStoryPacket(input());
  const candidateId = packet.candidates[0]?.candidateId ?? "";
  const revised = applyHumanStoryRevision(packet, {
    candidateId,
    reviewerReference: "reviewer:owner",
    reviewedAt: "2026-08-20T01:00:00.000Z",
    selections: [{ claimId: "claim-0", phrasingIndex: 1 }],
  }, claims);
  assert.equal(revised.candidates[0]?.blocks[0]?.sentences[0]?.text, phrasing.PROBLEM_CONTEXT[1]);
  assert.equal(revised.humanRevision?.reviewerReference, "reviewer:owner");
  assert.notEqual(revised.digest, packet.digest);
  assert.throws(() => applyHumanStoryRevision(packet, {
    candidateId,
    reviewerReference: "reviewer:owner",
    reviewedAt: "2026-08-20T01:00:00.000Z",
    selections: [{ claimId: "claim-0", phrasingIndex: 99 }],
  }, claims), /UNAPPROVED_REVISION/);
  assert.throws(() => applyHumanStoryRevision(packet, {
    candidateId,
    reviewerReference: "reviewer:owner",
    reviewedAt: "2026-08-20T01:00:00.000Z",
    selections: [{ claimId: "invented", phrasingIndex: 0 }],
  }, claims), /REVISION_CLAIM_NOT_IN_CANDIDATE/);
  assert.throws(() => applyHumanStoryRevision(packet, {
    candidateId,
    reviewerReference: "reviewer:owner",
    reviewedAt: "2026-08-20T01:00:00.000Z",
    selections: [{ claimId: "claim-0", phrasingIndex: 1 }],
  }, claims.map((claim, index) => index === 0 ? { ...claim, approvedPhrasings: ["발명된 표현"] } : claim)), /REVISION_CLAIM_SET_MISMATCH/);
});

test("16B packet has no operational or commerce-write decision surface", () => {
  const packet = buildEvidenceBoundPersuasiveStoryPacket(input());
  assert.equal("listingSubmission" in packet, false);
  assert.equal("price" in packet, false);
  assert.equal("itemSelectionScore" in packet, false);
  assert.equal(packet.executionEligible, false);
});
