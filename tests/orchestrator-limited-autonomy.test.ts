import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITED_AUTONOMY_POLICY_VERSION,
  evaluateLimitedAutonomyAdmission,
  type AdmissionCandidate,
  type LimitedAutonomyPolicy,
} from "../tools/orchestrator/limited-autonomy.ts";

const evaluation = {
  sampleSize: 60,
  exactMatch: 0.9,
  precision: { NEXT_TASK: 0.95, RETRY: 0.9, REPLAN: 0.95 },
  recall: { NEXT_TASK: 0.8, RETRY: 0.85, REPLAN: 0.9 },
} as const;

const policy: LimitedAutonomyPolicy = {
  version: LIMITED_AUTONOMY_POLICY_VERSION,
  approvedBy: "repository-owner",
  approvedAt: "2026-08-04T00:00:00.000Z",
  expiresAt: "2026-09-04T00:00:00.000Z",
  policyHash: "a".repeat(64),
  repositories: ["gonggam-online/gonggamline-ai"],
  taskClasses: [
    "DOCUMENTATION",
    "TEST",
    "MONITORING",
    "BEHAVIOR_EQUIVALENT_INTERNAL_REFACTOR",
  ],
  pathPolicy: {
    allowed: ["docs/**", "tests/**", "tools/orchestrator/**"],
    denied: ["supabase/**", "app/api/**", ".env*"],
  },
  caps: {
    perTaskTokenLimit: 100_000,
    perTaskWallTimeMinutes: 120,
    perTaskPaidCostKrw: 0,
    dailyTaskLimit: 3,
    dailyPaidCostKrw: 0,
  },
  shadow: {
    ownerLabeled: true,
    sampleSize: 60,
    outcomeCounts: { NEXT_TASK: 20, RETRY: 20, REPLAN: 20 },
    adversarialCount: 15,
    forbiddenOrUnverifiedNextTaskFalsePositives: 0,
    generalNextTaskFalsePositives: 1,
    dispatchOrExternalWrites: 0,
    evaluation,
  },
  incidentDrill: {
    completed: true,
    duplicateSuppressed: true,
    inFlightWorkStopped: true,
    externalStateReconciled: true,
    killSwitchVerified: true,
    auditChainVerified: true,
    evidenceReference: "artifact:incident-drill-1",
  },
};

const candidate: AdmissionCandidate = {
  repository: "gonggam-online/gonggamline-ai",
  taskClass: "DOCUMENTATION",
  paths: ["docs/orchestrator/phase-5.md"],
  risk: "normal-risk",
  deliveryTarget: "DRAFT_PR",
  paidCostKrw: 0,
  dailyTasksStarted: 0,
};

test("admits only a completely evidenced bounded Draft PR candidate", () => {
  assert.deepEqual(
    evaluateLimitedAutonomyAdmission(policy, candidate, "2026-08-05T00:00:00.000Z"),
    { authorized: true, mode: "BOUNDED_AUTONOMY", reasons: [] },
  );
});

test("fails closed when actual owner sample evidence or a threshold is missing", () => {
  for (const shadow of [
    { ...policy.shadow, sampleSize: 59 },
    { ...policy.shadow, adversarialCount: 14 },
    { ...policy.shadow, forbiddenOrUnverifiedNextTaskFalsePositives: 1 },
    { ...policy.shadow, generalNextTaskFalsePositives: 2 },
    { ...policy.shadow, dispatchOrExternalWrites: 1 },
    { ...policy.shadow, adversarialCount: -1 },
    { ...policy.shadow, generalNextTaskFalsePositives: -1 },
    { ...policy.shadow, evaluation: { ...evaluation, exactMatch: 0.84 } },
    { ...policy.shadow, evaluation: { ...evaluation, exactMatch: 1.01 } },
    { ...policy.shadow, evaluation: {
      ...evaluation,
      precision: { ...evaluation.precision, NEXT_TASK: 0.94 },
    } },
  ]) {
    const result = evaluateLimitedAutonomyAdmission(
      { ...policy, shadow }, candidate, "2026-08-05T00:00:00.000Z",
    );
    assert.equal(result.authorized, false);
    assert.equal(result.mode, "SHADOW");
  }
});

test("requires explicit numeric caps and zero paid cost", () => {
  for (const caps of [
    { ...policy.caps, perTaskTokenLimit: 0 },
    { ...policy.caps, perTaskWallTimeMinutes: 0 },
    { ...policy.caps, dailyTaskLimit: 0 },
    { ...policy.caps, perTaskPaidCostKrw: 1 as 0 },
    { ...policy.caps, dailyPaidCostKrw: 1 as 0 },
  ]) {
    assert.equal(evaluateLimitedAutonomyAdmission(
      { ...policy, caps }, candidate, "2026-08-05T00:00:00.000Z",
    ).authorized, false);
  }
});

test("incident drill is a binding admission gate", () => {
  for (const incidentDrill of [
    { ...policy.incidentDrill, completed: false as true },
    { ...policy.incidentDrill, duplicateSuppressed: false as true },
    { ...policy.incidentDrill, inFlightWorkStopped: false as true },
    { ...policy.incidentDrill, externalStateReconciled: false as true },
    { ...policy.incidentDrill, killSwitchVerified: false as true },
    { ...policy.incidentDrill, auditChainVerified: false as true },
    { ...policy.incidentDrill, evidenceReference: "" },
  ]) {
    assert.equal(evaluateLimitedAutonomyAdmission(
      { ...policy, incidentDrill }, candidate, "2026-08-05T00:00:00.000Z",
    ).authorized, false);
  }
});

test("forbidden boundaries, broader delivery, paid work, and expired approval stay gated", () => {
  const variants: readonly [LimitedAutonomyPolicy, AdmissionCandidate][] = [
    [policy, { ...candidate, paths: ["supabase/migrations/999.sql"] }],
    [policy, { ...candidate, paths: ["app/api/products/route.ts"] }],
    [policy, { ...candidate, paths: [".env.production"] }],
    [policy, { ...candidate, paths: ["tools/orchestrator/../../supabase/x.sql"] }],
    [policy, { ...candidate, risk: "high-risk" }],
    [policy, { ...candidate, deliveryTarget: "FINAL_MERGE" }],
    [policy, { ...candidate, paidCostKrw: 1 }],
    [policy, { ...candidate, dailyTasksStarted: policy.caps.dailyTaskLimit }],
    [{ ...policy, repositories: ["another/repository"] }, candidate],
  ];
  for (const [candidatePolicy, candidateVariant] of variants) {
    const result = evaluateLimitedAutonomyAdmission(
      candidatePolicy, candidateVariant, "2026-08-05T00:00:00.000Z",
    );
    assert.equal(result.authorized, false);
    assert.equal(result.mode, "SHADOW");
  }
  assert.equal(evaluateLimitedAutonomyAdmission(
    policy, candidate, policy.expiresAt,
  ).authorized, false);
  assert.equal(evaluateLimitedAutonomyAdmission(
    { ...policy, version: "stale-policy" as typeof LIMITED_AUTONOMY_POLICY_VERSION },
    candidate,
    "2026-08-05T00:00:00.000Z",
  ).authorized, false);
});
