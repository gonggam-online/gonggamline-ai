import assert from "node:assert/strict";
import test from "node:test";
import { approveConversionDetailPagePacket, buildConversionDetailPagePacket } from "../shared/domain/evidence-bound-conversion-detail-page.ts";
import { buildConversionDetailPageFixtureInput, DETAIL_FIXTURE_ASSET, STORY_DIGEST } from "./fixtures/conversion-detail-page.ts";

const digest = (character: string) => character.repeat(64);

test("16B v2 emits exact 15A/15B/15C/16A-bound renderable Shadow package", () => {
  const packet = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput());
  assert.equal(packet.version, "gonggamline-evidence-bound-conversion-detail-page-v2");
  assert.equal(packet.status, "REVIEW_READY");
  assert.equal(packet.mode, "SHADOW");
  assert.equal(packet.executionEligible, false);
  assert.equal(packet.publicationAuthorized, false);
  assert.equal(packet.listingSubmission, null);
  assert.equal(packet.keywordPacketDigest, "9808c36fff368d26fe0731f356548199b11c0e14e92c65a1b998305cc87415a4");
  assert.equal(packet.titlePacketDigest, "7a71c429c203961be4eb6c6b35bfcf3731d0143e04add7af07bc43df1e8f5c22");
  assert.equal(packet.creativePacketDigest, "3c73e2d0b8664f02db80f759f69a7f0fd2f07c1deecbca9794f00d1e9558e8dd");
  assert.equal(packet.storyPacketDigest, STORY_DIGEST);
  assert.equal(packet.content.length, 9);
  assert.ok(packet.content.every(({ sentences }) => sentences.every(({ sourceReferences }) => sourceReferences.every((value) => value.startsWith("evidence:")))));
  assert.equal(packet.assets[0]?.editOperation, "CROP_SQUARE");
  assert.equal(packet.previewComparison.responsive, true);
  assert.equal(packet.conversionReadiness.score, 100);
  assert.equal(packet.digest, "c669ca8c2853494141a7343792da6fc5e59ec7dbdda1308ccd204649fb4eb587");
});

test("every upstream digest and story binding fails closed on drift", () => {
  const fixture = buildConversionDetailPageFixtureInput();
  assert.throws(() => buildConversionDetailPagePacket({ ...fixture, expectedCreativePacketDigest: digest("0") }), /CREATIVE_PACKET_DIGEST_MISMATCH/);
  assert.throws(() => buildConversionDetailPagePacket({ ...fixture, expectedStoryPacketDigest: digest("0") }), /STORY_PACKET_DIGEST_MISMATCH/);
  assert.throws(() => buildConversionDetailPagePacket({ ...fixture, creativePacketDigest: digest("0"), expectedCreativePacketDigest: digest("0") }), /STORY_CREATIVE_BINDING_MISMATCH/);
  assert.throws(() => buildConversionDetailPagePacket({ ...fixture, marketplacePolicyDigest: digest("0") }), /STORY_POLICY_BINDING_MISMATCH/);
});

test("claim/source/asset/grant/edit-operation mismatches quarantine and exclude the asset", () => {
  for (const asset of [{ ...DETAIL_FIXTURE_ASSET, creativeCandidateId: "unknown:crop_square" }, { ...DETAIL_FIXTURE_ASSET, sourceAssetDigest: digest("0") }, { ...DETAIL_FIXTURE_ASSET, grantDigest: digest("0") }, { ...DETAIL_FIXTURE_ASSET, editOperation: "BACKGROUND_REMOVE" }]) {
    const packet = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput({ assets: [asset] }));
    assert.equal(packet.status, "QUARANTINED");
    assert.doesNotMatch(packet.html, /assets\.invalid\/kk946-main\.png/);
    assert.ok(packet.conversionReadiness.blockingReasons.some((reason) => reason.includes("MISMATCH")));
  }
});

test("unknown/prohibited/revoked rights and visual failures stay fail closed", () => {
  for (const rights of ["UNKNOWN", "PROHIBITED", "REVOKED"] as const) {
    const packet = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput({ assets: [{ ...DETAIL_FIXTURE_ASSET, rights }] }));
    assert.equal(packet.status, "QUARANTINED");
    assert.ok(packet.conversionReadiness.blockingReasons.includes(`ASSET_RIGHTS_${rights}:kk946-main`));
    assert.doesNotMatch(packet.html, /assets\.invalid\/kk946-main\.png/);
  }
  const viewportQa = buildConversionDetailPageFixtureInput().viewportQa;
  const packet = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput({ viewportQa: [{ ...viewportQa[0], clippedElementCount: 1, minimumBodyFontPixels: 14 }, viewportQa[1]] }));
  assert.equal(packet.status, "QUARANTINED");
  assert.ok(packet.conversionReadiness.blockingReasons.includes("VIEWPORT_QA_FAILED:MOBILE_360"));
});

test("ordering, HTML and packet digests are deterministic", () => {
  const extra = { ...DETAIL_FIXTURE_ASSET, assetId: "kk946-detail", role: "DETAIL" as const, artifactDigest: digest("2") };
  const first = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput({ assets: [DETAIL_FIXTURE_ASSET, extra] }));
  const second = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput({ assets: [extra, DETAIL_FIXTURE_ASSET], viewportQa: [...buildConversionDetailPageFixtureInput().viewportQa].reverse() }));
  assert.deepEqual(first, second);
});

test("human approval binds exact detail packet but never enables execution or publish", () => {
  const packet = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput());
  const approved = approveConversionDetailPagePacket(packet, { approvalReference: "approval:16b-owner", reviewerReference: "reviewer:owner", approvedAt: "2026-08-20T03:00:00.000Z", boundPacketDigest: packet.digest });
  assert.equal(approved.status, "APPROVED_SHADOW");
  assert.equal(approved.executionEligible, false);
  assert.equal(approved.publicationAuthorized, false);
  assert.equal(approved.listingSubmission, null);
  assert.equal(approved.digest, "c81942d7b6e0d9ee5eae279137c27654339ecb81539ea790173f2cc7e8bb75f0");
  assert.throws(() => approveConversionDetailPagePacket(packet, { approvalReference: "approval:16b-owner", reviewerReference: "reviewer:owner", approvedAt: "2026-08-20T03:00:00.000Z", boundPacketDigest: digest("0") }), /DETAIL_PAGE_APPROVAL_BINDING_INVALID/);
});

test("synthetic HTML is escaped and exposes no operational decision surface", () => {
  const packet = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput({ title: "fixture <script>alert(1)</script>" }));
  assert.doesNotMatch(packet.html, /<script>/);
  assert.match(packet.html, /&lt;script&gt;/);
  for (const forbidden of ["price", "itemSelectionScore", "publish", "upload", "provider"]) assert.equal(forbidden in packet, false);
});
