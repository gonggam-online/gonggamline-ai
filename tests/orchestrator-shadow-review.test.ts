import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOwnerSample,
  reviewInShadow,
  scoreShadowCandidate,
  type ShadowReviewInput,
} from "../tools/orchestrator/shadow-review.ts";

const baseInput: ShadowReviewInput = {
  context: {
    projectId: "gonggamline-ai",
    baseSha: "a".repeat(40),
    policyVersion: "policy-v1",
    architectureVersion: "orchestrator-v1",
    claims: [{
      key: "mainHead",
      value: "a".repeat(40),
      source: "GIT",
      evidenceReference: "git:origin/main",
      verifiedAt: "2026-08-04T00:00:00.000Z",
    }],
  },
  candidate: {
    candidateId: "candidate-1",
    objective: "Reduce operator review time",
    paths: ["tools/orchestrator/shadow-review.ts"],
    revenueImpact: { monthlyKrw: 5_000_000, confidence: 0.5 },
    operatorMinutesSaved: 120,
    urgency: 0.8,
    dependencyReady: true,
  },
  pathPolicy: {
    allowed: ["tools/orchestrator/**", "tests/**", "docs/orchestrator/**"],
    denied: ["supabase/**", "app/api/products/**", ".env*"],
  },
};

test("verified candidate is scored and proposed without dispatch authority", () => {
  const result = reviewInShadow(baseInput);
  assert.equal(result.outcome, "NEXT_TASK");
  assert.equal(result.score, 29);
  assert.equal(result.mode, "SHADOW");
  assert.equal(result.dispatchAuthorized, false);
  assert.equal("execute" in result, false);
});

test("retryable verified failure becomes RETRY only within budget", () => {
  assert.equal(reviewInShadow({
    ...baseInput,
    priorOutcome: { state: "RETRYABLE_FAILURE", retryBudgetRemaining: 1 },
  }).outcome, "RETRY");
  assert.equal(reviewInShadow({
    ...baseInput,
    priorOutcome: { state: "RETRYABLE_FAILURE", retryBudgetRemaining: 0 },
  }).outcome, "REPLAN");
});

test("adversarial forbidden scope is fail-closed REPLAN", () => {
  for (const path of [
    "supabase/migrations/999_shadow.sql",
    "app/api/products/route.ts",
    ".env.production",
    "tools/orchestrator/../../supabase/migrations/999.sql",
  ]) {
    const result = reviewInShadow({
      ...baseInput,
      candidate: { ...baseInput.candidate, paths: [path] },
    });
    assert.equal(result.outcome, "REPLAN", path);
    assert.equal(result.dispatchAuthorized, false);
  }
});

test("unverified or hallucinated context is rejected", () => {
  assert.throws(() => reviewInShadow({
    ...baseInput,
    context: { ...baseInput.context, claims: [] },
  }), /at least one claim/);
  assert.throws(() => reviewInShadow({
    ...baseInput,
    context: { ...baseInput.context, baseSha: "main" },
  }), /full lowercase base SHA/);
  assert.throws(() => reviewInShadow({
    ...baseInput,
    context: {
      ...baseInput.context,
      claims: [{ ...baseInput.context.claims[0], evidenceReference: "" }],
    },
  }), /lacks verifiable evidence/);
});

test("revenue/time scoring validates inputs and stays bounded", () => {
  assert.equal(scoreShadowCandidate(baseInput.candidate), 29);
  assert.throws(() => scoreShadowCandidate({
    ...baseInput.candidate,
    revenueImpact: { monthlyKrw: 1, confidence: 2 },
  }), /confidence/);
  assert.ok(scoreShadowCandidate({
    ...baseInput.candidate,
    revenueImpact: { monthlyKrw: 1_000_000_000, confidence: 1 },
    operatorMinutesSaved: 100_000,
    urgency: 1,
  }) <= 100);
});

test("owner-scored sample reports per-outcome precision and recall", () => {
  const evaluation = evaluateOwnerSample([
    { sampleId: "1", proposed: "NEXT_TASK", approved: "NEXT_TASK" },
    { sampleId: "2", proposed: "NEXT_TASK", approved: "REPLAN" },
    { sampleId: "3", proposed: "RETRY", approved: "RETRY" },
    { sampleId: "4", proposed: "REPLAN", approved: "REPLAN" },
  ]);
  assert.equal(evaluation.sampleSize, 4);
  assert.equal(evaluation.exactMatch, 0.75);
  assert.equal(evaluation.precision.NEXT_TASK, 0.5);
  assert.equal(evaluation.recall.REPLAN, 0.5);
  assert.equal(evaluation.precision.RETRY, 1);
});
