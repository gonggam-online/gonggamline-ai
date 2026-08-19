import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketLearningPacket } from "../shared/domain/market-learning-loop.ts";

const base = {
  lessonId: "lesson-1",
  source: "benchmark" as const,
  subject: "keyword:정리용품",
  statement: "구매의도 키워드가 상위 10개에 반복 관측됨",
  evidenceDigest: "a".repeat(64),
  observedAt: "2026-08-19T00:00:00.000Z",
  confidence: 82,
  appliesTo: ["keyword", "item-selection-shadow"],
  policyVersion: "market-policy-v1",
  approvalDigest: null,
};

test("shadow learning is immediately consumable but never operationally applied", () => {
  const packet = buildMarketLearningPacket([base], "SHADOW", new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(packet.requiresReview, true);
  assert.deepEqual(packet.appliedSubjects, []);
  assert.match(packet.packetDigest, /^fnv1a:/);
});

test("operational learning requires approval and rejects conflicts", () => {
  const packet = buildMarketLearningPacket([
    { ...base, approvalDigest: "b".repeat(64) },
    { ...base, lessonId: "lesson-2", statement: "구매의도 키워드가 반복되지 않음", confidence: 60, approvalDigest: "c".repeat(64) },
  ], "APPROVED_OPERATIONAL", new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(packet.requiresReview, true);
  assert.deepEqual(packet.appliedSubjects, []);
  assert.deepEqual(packet.conflicts, ["conflict:keyword:정리용품"]);
});
