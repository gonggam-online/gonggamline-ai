import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ASSET_ERROR_ISOLATION_POLICY_DIGEST,
  ASSET_RIGHTS_POLICY_DIGEST,
  buildProductCreativePacket,
  productCreativePacketDigest,
  reviewProductCreativePacket,
  type CreativeAssetEvidence,
  type CreativePolicySnapshot,
} from "../shared/domain/evidence-bound-product-creative.ts";

const keywordDigest = "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4";
const titleDigest = "7a71c429c203961be4eb6c6b35bfcf3731d0143e04add7af07bc43df1e8f5c22";

function assets(): readonly CreativeAssetEvidence[] {
  return JSON.parse(readFileSync(new URL("./fixtures/product-creative/kk946-rights-cleared-assets-v1.json", import.meta.url), "utf8")) as readonly CreativeAssetEvidence[];
}

const policy: CreativePolicySnapshot = {
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
};

function input(overrides: Partial<Parameters<typeof buildProductCreativePacket>[0]> = {}) {
  return {
    candidateId: "KK946",
    generatedAt: "2026-08-20T00:00:00.000Z",
    keywordSetVersion: "kk946-keywords-v1",
    keywordPacketDigest: keywordDigest,
    expectedKeywordPacketDigest: keywordDigest,
    keywordRelevanceScore: 100,
    titlePacketDigest: titleDigest,
    expectedTitlePacketDigest: titleDigest,
    policySnapshot: policy,
    assets: assets(),
    ...overrides,
  };
}

test("15C emits a deterministic rights-cleared Shadow manifest, candidates and score breakdown", () => {
  const packet = buildProductCreativePacket(input());
  assert.equal(packet.mode, "SHADOW");
  assert.equal(packet.executionEligible, false);
  assert.equal(packet.status, "PARTIAL");
  assert.equal(packet.keywordPacketDigest, keywordDigest);
  assert.equal(packet.titlePacketDigest, titleDigest);
  assert.equal(packet.policyBindings.assetRightsPolicyDigest, ASSET_RIGHTS_POLICY_DIGEST);
  assert.equal(packet.policyBindings.assetErrorIsolationPolicyDigest, ASSET_ERROR_ISOLATION_POLICY_DIGEST);
  assert.equal(packet.candidates.length, 3);
  assert.deepEqual(packet.candidates.map(({ operation }) => operation).sort(), ["BRIGHTNESS_ADJUST", "CROP_SQUARE", "ORIGINAL_USE"]);
  assert.ok(packet.candidates.every((candidate) => candidate.status === "VERIFIED" && candidate.score !== null));
  assert.ok(packet.candidates.every((candidate) => candidate.provenance.transformation.changesProductFacts === false));
  assert.ok(packet.candidates.every((candidate) => Object.keys(candidate.scoreBreakdown).length === 6));
  assert.match(packet.digest, /^[a-f0-9]{64}$/);
  assert.equal(productCreativePacketDigest(packet), packet.digest);
});

test("UNKNOWN, CONFLICT, PROHIBITED, stale and revoked rights quarantine only that asset lane", () => {
  for (const state of ["UNKNOWN", "CONFLICT", "PROHIBITED"] as const) {
    const changed = assets().map((asset, index) => index === 0 ? { ...asset, state } : asset);
    const packet = buildProductCreativePacket(input({ assets: changed }));
    assert.equal(packet.status, "QUARANTINED");
    assert.equal(packet.candidates.length, 0);
    assert.ok(packet.quarantinedAssetIds.includes("kk946-front-photo"));
  }
  const stale = assets().map((asset, index) => index === 0 ? { ...asset, rights: { ...asset.rights, expiresAt: "2026-08-19T00:00:00.000Z" } } : asset);
  assert.ok(buildProductCreativePacket(input({ assets: stale })).assetManifest[0]?.exclusionReasons.includes("RIGHTS_STALE"));
  const revoked = assets().map((asset, index) => index === 0 ? { ...asset, rights: { ...asset.rights, revoked: true } } : asset);
  assert.ok(buildProductCreativePacket(input({ assets: revoked })).assetManifest[0]?.exclusionReasons.includes("RIGHTS_REVOKED"));
});

test("edit permission is exact per operation and unsupported derivative operations never produce candidates", () => {
  const packet = buildProductCreativePacket(input());
  assert.equal(packet.candidates.some(({ operation }) => operation === "BACKGROUND_REMOVE"), false);
  assert.deepEqual(packet.assetManifest[0]?.allowedOperations, ["ORIGINAL_USE", "CROP_SQUARE", "BRIGHTNESS_ADJUST"]);
  assert.equal(packet.assetManifest[1]?.state, "QUARANTINED");
  assert.ok(packet.assetManifest[1]?.exclusionReasons.includes("RIGHTS_USE_UNKNOWN"));
});

test("policy, keyword and title digest drift fail closed before creative planning", () => {
  assert.throws(() => buildProductCreativePacket(input({ expectedKeywordPacketDigest: "0".repeat(64) })), /KEYWORD_PACKET_DIGEST_MISMATCH/);
  assert.throws(() => buildProductCreativePacket(input({ expectedTitlePacketDigest: "0".repeat(64) })), /TITLE_PACKET_DIGEST_MISMATCH/);
  for (const state of ["UNKNOWN", "CONFLICT", "PROHIBITED"] as const) {
    const packet = buildProductCreativePacket(input({ policySnapshot: { ...policy, state } }));
    assert.equal(packet.status, "QUARANTINED");
    assert.equal(packet.candidates.length, 0);
  }
  const stalePolicy = buildProductCreativePacket(input({ policySnapshot: { ...policy, expiresAt: "2026-08-19T00:00:00.000Z" } }));
  assert.ok(stalePolicy.assetManifest.every(({ exclusionReasons }) => exclusionReasons.includes("POLICY_STALE")));
});

test("input ordering has stable ranking, tie-break, manifest and packet digest", () => {
  const first = buildProductCreativePacket(input());
  const second = buildProductCreativePacket(input({ assets: [...assets()].reverse(), policySnapshot: { ...policy, allowedOperations: [...policy.allowedOperations].reverse() } }));
  assert.deepEqual(first, second);
  assert.deepEqual(first.candidates.map(({ rank }) => rank), [1, 2, 3]);
});

test("human review selects only a verified candidate and preserves Shadow-only rollback", () => {
  const packet = buildProductCreativePacket(input());
  const selectedCandidateId = packet.candidates[0]?.candidateId ?? "";
  const approved = reviewProductCreativePacket(packet, {
    decision: "APPROVED",
    selectedCandidateId,
    reviewerReference: "reviewer:owner",
    reviewedAt: "2026-08-20T01:00:00.000Z",
  });
  assert.equal(approved.humanReview.status, "APPROVED");
  assert.equal(approved.executionEligible, false);
  assert.equal(approved.rollback.strategy, "DISCARD_SHADOW_PACKET");
  assert.notEqual(approved.digest, packet.digest);
  assert.throws(() => reviewProductCreativePacket(packet, {
    decision: "APPROVED", selectedCandidateId: "missing", reviewerReference: "reviewer:owner", reviewedAt: "2026-08-20T01:00:00.000Z",
  }), /CREATIVE_CANDIDATE_NOT_APPROVABLE/);
});

test("packet has no provider, persistence, publication, Item Selection or commerce decision surface", () => {
  const packet = buildProductCreativePacket(input());
  for (const forbidden of ["provider", "upload", "publication", "listingSubmission", "price", "itemSelectionScore", "recommendation"]) {
    assert.equal(forbidden in packet, false);
  }
  assert.equal(packet.humanReview.required, true);
  assert.equal(packet.executionEligible, false);
});
