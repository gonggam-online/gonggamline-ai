import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { KeywordIntelligencePacket } from "../shared/domain/competitive-keyword-intelligence.ts";
import {
  buildEvidenceBoundTitleRankingPacket,
  keywordPacketDigest,
  type ProductEvidenceFact,
} from "../shared/domain/evidence-bound-title-ranking.ts";

const generatedAt = "2026-08-20T00:00:00.000Z";
const evidenceDigest = "a".repeat(64);

function packet(): KeywordIntelligencePacket {
  return JSON.parse(readFileSync(new URL("./fixtures/competitive-keyword-intelligence/kk946-15b-packet-v1.json", import.meta.url), "utf8")) as KeywordIntelligencePacket;
}

const facts: readonly ProductEvidenceFact[] = [
  { factId: "fact-name", field: "PRODUCT_NAME", value: "케이블 파우치", state: "VERIFIED", sourceReference: "https://fixture.example/product", evidenceDigest },
  { factId: "fact-category", field: "CATEGORY", value: "정리용품", state: "VERIFIED", sourceReference: "https://fixture.example/category", evidenceDigest },
];

test("15B binds the exact 15A version and digest and emits a Shadow-only packet", () => {
  const keywordPacket = packet();
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/competitive-keyword-intelligence/kk946-15b-packet-v1.json", import.meta.url), "utf8"));
  const result = buildEvidenceBoundTitleRankingPacket({
    keywordPacket,
    expectedKeywordSetVersion: "kk946-keywords-v1",
    expectedKeywordPacketDigest: fixture.digest,
    candidateId: "KK946",
    generatedAt,
    facts,
    policy: { titleMaxLength: 100, keywordMaxCount: 20, keywordMaxLength: 20, forbiddenTerms: [], competitorMarks: [], prohibitedClaimPatterns: [] },
  });
  assert.equal(keywordPacketDigest(keywordPacket), fixture.digest);
  assert.equal(result.mode, "SHADOW");
  assert.equal(result.executionEligible, false);
  assert.equal(result.keywordSetVersion, "kk946-keywords-v1");
  assert.equal(result.keywordPacketDigest, fixture.digest);
  assert.equal(result.titleCandidates[0]?.status, "VERIFIED");
  assert.match(result.digest, /^[a-f0-9]{64}$/);
});

test("version or digest drift is rejected before candidate generation", () => {
  const keywordPacket = packet();
  assert.throws(() => buildEvidenceBoundTitleRankingPacket({
    keywordPacket,
    expectedKeywordSetVersion: "other-version",
    expectedKeywordPacketDigest: keywordPacketDigest(keywordPacket),
    candidateId: "KK946",
    generatedAt,
    facts,
    policy: { titleMaxLength: 100, keywordMaxCount: 20, keywordMaxLength: 20, forbiddenTerms: [], competitorMarks: [], prohibitedClaimPatterns: [] },
  }), /KEYWORD_SET_VERSION_MISMATCH/);
  assert.throws(() => buildEvidenceBoundTitleRankingPacket({
    keywordPacket,
    expectedKeywordSetVersion: "kk946-keywords-v1",
    expectedKeywordPacketDigest: "0".repeat(64),
    candidateId: "KK946",
    generatedAt,
    facts,
    policy: { titleMaxLength: 100, keywordMaxCount: 20, keywordMaxLength: 20, forbiddenTerms: [], competitorMarks: [], prohibitedClaimPatterns: [] },
  }), /KEYWORD_PACKET_DIGEST_MISMATCH/);
});

test("prohibited claims, marks, stuffing, unknown facts and stale packet evidence quarantine output", () => {
  const keywordPacket = packet();
  const result = buildEvidenceBoundTitleRankingPacket({
    keywordPacket,
    expectedKeywordSetVersion: "kk946-keywords-v1",
    expectedKeywordPacketDigest: keywordPacketDigest(keywordPacket),
    candidateId: "KK946",
    generatedAt,
    facts: [...facts, { ...facts[0], factId: "unknown", state: "UNKNOWN" }],
    policy: { titleMaxLength: 10, keywordMaxCount: 20, keywordMaxLength: 20, forbiddenTerms: ["케이블"], competitorMarks: ["브랜드"], prohibitedClaimPatterns: ["최고|완벽"] },
  });
  assert.equal(result.status, "QUARANTINED");
  assert.ok(result.titleCandidates.every((candidate) => candidate.status === "QUARANTINED"));
  assert.ok(result.titleCandidates.every((candidate) => candidate.exclusionReasons.some((reason) => ["EVIDENCE_NOT_VERIFIED", "TITLE_TOO_LONG", "FORBIDDEN_TERM", "COMPETITOR_MARK", "PROHIBITED_CLAIM", "KEYWORD_STUFFING"].includes(reason))));
  assert.ok(result.keywordCandidates.every((candidate) => candidate.status === "QUARANTINED"));
});

test("same semantic input produces a stable ranking and provenance packet", () => {
  const keywordPacket = packet();
  const input = {
    keywordPacket,
    expectedKeywordSetVersion: "kk946-keywords-v1",
    expectedKeywordPacketDigest: keywordPacketDigest(keywordPacket),
    candidateId: "KK946",
    generatedAt,
    facts,
    policy: { titleMaxLength: 100, keywordMaxCount: 20, keywordMaxLength: 20, forbiddenTerms: [], competitorMarks: [], prohibitedClaimPatterns: [] },
  } as const;
  const first = buildEvidenceBoundTitleRankingPacket(input);
  const second = buildEvidenceBoundTitleRankingPacket({ ...input, facts: [...facts].reverse() });
  assert.deepEqual(first, second);
  assert.equal(first.titleCandidates[0]?.provenance.keywordSetVersion, "kk946-keywords-v1");
  assert.deepEqual(first.titleCandidates[0]?.provenance.factIds, ["fact-category", "fact-name"]);
});

test("existing Item Selection decisions are not present in the packet", () => {
  const keywordPacket = packet();
  const result = buildEvidenceBoundTitleRankingPacket({
    keywordPacket,
    expectedKeywordSetVersion: "kk946-keywords-v1",
    expectedKeywordPacketDigest: keywordPacketDigest(keywordPacket),
    candidateId: "KK946",
    generatedAt,
    facts,
    policy: { titleMaxLength: 100, keywordMaxCount: 20, keywordMaxLength: 20, forbiddenTerms: [], competitorMarks: [], prohibitedClaimPatterns: [] },
  });
  assert.equal("itemSelectionScore" in result, false);
  assert.equal("recommendation" in result, false);
  assert.equal(result.executionEligible, false);
});
