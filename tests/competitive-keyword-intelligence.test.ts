import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildKeywordIntelligencePacket,
  normalizeKeywordProviderEnvelope,
  normalizeKeywordText,
  type KeywordProvider,
  type KeywordProviderRecord,
} from "../shared/domain/competitive-keyword-intelligence.ts";

const GENERATED_AT = "2026-08-20T00:00:00.000Z";

function record(overrides: Partial<KeywordProviderRecord> = {}): KeywordProviderRecord {
  return {
    provider: "NAVER",
    sourceReference: "https://fixture.example/naver/1",
    observedAt: "2026-08-19T00:00:00.000Z",
    query: "케이블 파우치",
    keyword: "케이블 파우치",
    kind: "CORE",
    metrics: { demand: 82, competition: 38, trend: 71, contentGap: 64, profitability: 76 },
    rightsStatus: "ALLOWED",
    ...overrides,
  };
}

function packet(records: readonly KeywordProviderRecord[]) {
  return buildKeywordIntelligencePacket({
    candidateId: "KK946",
    keywordSetVersion: "kk946-keywords-v1",
    generatedAt: GENERATED_AT,
    aliases: [{ canonical: "케이블 파우치", variants: ["케이블파우치", "Cable Pouch", "cable-pouch"] }],
    records,
  });
}

test("canonicalization merges whitespace, punctuation, NFC, language and explicit synonym variants", () => {
  assert.equal(normalizeKeywordText("  CABLE—Pouch!! "), "cable-pouch");
  const result = packet([
    record(),
    record({ provider: "YOUTUBE", sourceReference: "https://fixture.example/youtube/1", keyword: "Cable Pouch", kind: "RELATED" }),
    record({ provider: "DATAFORSEO", sourceReference: "https://fixture.example/dataforseo/1", keyword: "케이블파우치", kind: "PROBLEM_USE_CASE" }),
  ]);
  assert.equal(result.keywords.length, 1);
  assert.equal(result.keywords[0]?.canonical, "케이블 파우치");
  assert.deepEqual(result.keywords[0]?.kinds, ["CORE", "RELATED", "PROBLEM_USE_CASE"]);
});

test("identical semantic input produces an identical digest and stable tie ranking", () => {
  const records = [record({ keyword: "충전기 정리" }), record({ keyword: "선 정리" })];
  const first = packet(records);
  const second = packet([...records].reverse());
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first, second);
  assert.deepEqual(first.keywords.map(({ canonical }) => canonical), ["선 정리", "충전기 정리"]);
});

test("score exposes demand, competition opportunity, trend, content gap, profitability, relevance and confidence", () => {
  const result = packet([
    record(),
    record({ provider: "YOUTUBE", sourceReference: "https://fixture.example/youtube/1" }),
    record({ provider: "DATAFORSEO", sourceReference: "https://fixture.example/dataforseo/1" }),
  ]);
  assert.equal(result.status, "READY");
  assert.equal(result.mode, "SHADOW");
  assert.equal(result.keywords[0]?.state, "VERIFIED");
  assert.deepEqual(result.keywords[0]?.scoreBreakdown, {
    demand: 82,
    competitionOpportunity: 62,
    trend: 71,
    contentGap: 64,
    profitability: 76,
    relevance: 100,
    confidence: 100,
  });
  assert.equal(result.keywords[0]?.evidence.length, 3);
  assert.match(result.keywords[0]?.evidence[0]?.evidenceDigest ?? "", /^[a-f0-9]{64}$/);
});

test("stale, conflicting and unknown-rights evidence fails closed", () => {
  const result = packet([
    record({ observedAt: "2026-01-01T00:00:00.000Z", keyword: "오래된 키워드" }),
    record({ keyword: "충돌 키워드", metrics: { demand: 5, competition: 40, trend: 50, contentGap: 50, profitability: 60 } }),
    record({ provider: "YOUTUBE", sourceReference: "https://fixture.example/youtube/2", keyword: "충돌 키워드", metrics: { demand: 90, competition: 40, trend: 50, contentGap: 50, profitability: 60 } }),
    record({ keyword: "권리 미상", rightsStatus: "UNKNOWN" }),
  ]);
  assert.equal(result.status, "QUARANTINED");
  assert.equal(result.keywords.find(({ canonical }) => canonical === "오래된 키워드")?.state, "QUARANTINED");
  assert.ok(result.keywords.find(({ canonical }) => canonical === "충돌 키워드")?.exclusionReasons.includes("EVIDENCE_CONFLICT"));
  assert.ok(result.keywords.find(({ canonical }) => canonical === "권리 미상")?.exclusionReasons.includes("RIGHTS_UNKNOWN"));
  assert.ok(result.keywords.filter(({ state }) => state === "QUARANTINED").every(({ score }) => score === null));
});

for (const provider of ["NAVER", "YOUTUBE", "DATAFORSEO"] as const satisfies readonly KeywordProvider[]) {
  test(`${provider} envelope rejects malformed, forbidden, rate-limited and empty responses`, () => {
    const base = { provider, estimatedCostUsd: 0, maxCostUsd: 0 } as const;
    assert.throws(() => normalizeKeywordProviderEnvelope({ ...base, status: 403, records: [] }), /FORBIDDEN/);
    assert.throws(() => normalizeKeywordProviderEnvelope({ ...base, status: 429, records: [] }), /RATE_LIMITED/);
    assert.throws(() => normalizeKeywordProviderEnvelope({ ...base, status: 200, records: {} }), /MALFORMED/);
    assert.throws(() => normalizeKeywordProviderEnvelope({ ...base, status: 200, records: [] }), /EMPTY/);
  });
}

test("paid provider response is rejected when its reported cost exceeds the exact ceiling", () => {
  assert.throws(() => normalizeKeywordProviderEnvelope({
    provider: "DATAFORSEO",
    status: 200,
    estimatedCostUsd: 0.02,
    maxCostUsd: 0.01,
    records: [record({ provider: "DATAFORSEO" })],
  }), /COST_CEILING_EXCEEDED/);
});

test("15B packet contract is versioned, digest-bound and contains no operational decision", () => {
  const result = packet([
    record(),
    record({ provider: "YOUTUBE", sourceReference: "https://fixture.example/youtube/1", keyword: "Cable Pouch", kind: "RELATED" }),
    record({ provider: "DATAFORSEO", sourceReference: "https://fixture.example/dataforseo/1", keyword: "케이블파우치", kind: "PROBLEM_USE_CASE" }),
  ]);
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/competitive-keyword-intelligence/kk946-15b-packet-v1.json", import.meta.url), "utf8"));
  assert.equal(result.version, "gonggamline-competitive-keyword-intelligence-v1");
  assert.equal(result.keywordSetVersion, "kk946-keywords-v1");
  assert.match(result.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(result, fixture);
  assert.equal("recommendation" in result, false);
  assert.equal("itemSelectionScore" in result, false);
});
