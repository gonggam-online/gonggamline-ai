import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { BudgetExceededError, BudgetGuard } from "../tools/orchestrator/budget.ts";
import { OrchestratorLedger } from "../tools/orchestrator/ledger.ts";
import {
  evaluateLimitedAutonomyAdmission,
  type LimitedCandidatePolicy,
  type LimitedTaskClass,
} from "../tools/orchestrator/limited-autonomy.ts";
import { interruptThenPlanRecovery } from "../tools/orchestrator/recovery.ts";
import { evaluateShadowAdmissionScenario } from "../tools/orchestrator/shadow-admission-evaluation.ts";
import {
  evaluateOwnerSample,
  type ShadowOutcome,
} from "../tools/orchestrator/shadow-review.ts";

interface ReviewCase {
  readonly sampleId: string;
  readonly summary: string;
  readonly taskClass: LimitedTaskClass;
  readonly paths: readonly string[];
  readonly ownerDecision: ShadowOutcome;
  readonly adversarial: boolean;
  readonly reason: string;
  readonly inputProfile: string;
}

interface InputProfile {
  readonly repository?: string;
  readonly contextState?: "MISSING_CLAIMS" | "INVALID_BASE_SHA";
  readonly dependencyReady?: boolean;
  readonly priorOutcome?: {
    readonly state: "SUCCEEDED" | "RETRYABLE_FAILURE" | "CONTRACT_INVALID";
    readonly retryBudgetRemaining: number;
  };
  readonly risk?: "normal-risk" | "high-risk";
  readonly deliveryTarget?: "DRAFT_PR" | "FINAL_MERGE";
  readonly paidCostKrw?: number;
  readonly dailyTasksStarted?: number;
  readonly evaluatedAt?: string;
}

interface ReviewFixture {
  readonly schemaVersion: string;
  readonly repository: string;
  readonly policyVersion: string;
  readonly labelStatus: string;
  readonly inputProfiles: Readonly<Record<string, InputProfile>>;
  readonly cases: readonly ReviewCase[];
}

interface CapsFixture {
  readonly schemaVersion: string;
  readonly approvalReference: string;
  readonly repository: string;
  readonly perTaskTokenLimit: number;
  readonly perTaskWallTimeMinutes: number;
  readonly dailyTaskLimit: number;
  readonly perTaskPaidCostKrw: number;
  readonly dailyPaidCostKrw: number;
  readonly expiresAt: string;
  readonly configHash: string;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function readFixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8")) as T;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function configHash(caps: CapsFixture): string {
  const approvedConfig = {
    schemaVersion: caps.schemaVersion,
    approvalReference: caps.approvalReference,
    repository: caps.repository,
    perTaskTokenLimit: caps.perTaskTokenLimit,
    perTaskWallTimeMinutes: caps.perTaskWallTimeMinutes,
    dailyTaskLimit: caps.dailyTaskLimit,
    perTaskPaidCostKrw: caps.perTaskPaidCostKrw,
    dailyPaidCostKrw: caps.dailyPaidCostKrw,
    expiresAt: caps.expiresAt,
  };
  return createHash("sha256").update(stableJson(approvedConfig), "utf8").digest("hex");
}

const pathPolicy = {
  allowed: ["docs/**", "tests/**", "tools/orchestrator/**", ".codex/WORK_STATUS.md"],
  denied: ["supabase/**", "app/api/**", ".env.production"],
} as const;

function candidatePolicy(caps: CapsFixture): LimitedCandidatePolicy {
  return {
    version: "gonggamline-limited-autonomy-v1",
    approvedBy: caps.approvalReference,
    approvedAt: "2026-08-04T09:06:11.000Z",
    expiresAt: caps.expiresAt,
    policyHash: caps.configHash,
    repositories: [caps.repository],
    taskClasses: ["DOCUMENTATION", "TEST", "MONITORING", "BEHAVIOR_EQUIVALENT_INTERNAL_REFACTOR"],
    pathPolicy,
    caps: {
      perTaskTokenLimit: caps.perTaskTokenLimit,
      perTaskWallTimeMinutes: caps.perTaskWallTimeMinutes,
      perTaskPaidCostKrw: 0,
      dailyTaskLimit: caps.dailyTaskLimit,
      dailyPaidCostKrw: 0,
    },
  };
}

function generatedOutcome(
  fixture: ReviewFixture,
  caps: CapsFixture,
  sample: ReviewCase,
): ReturnType<typeof evaluateShadowAdmissionScenario> {
  const profile = fixture.inputProfiles[sample.inputProfile];
  assert.ok(profile, `unknown input profile: ${sample.inputProfile}`);
  const contextState = profile.contextState;
  return evaluateShadowAdmissionScenario(candidatePolicy(caps), {
    review: {
      context: {
        projectId: "phase-5-owner-sample",
        baseSha: contextState === "INVALID_BASE_SHA" ? "unknown" : "a".repeat(40),
        policyVersion: fixture.policyVersion,
        architectureVersion: "orchestrator-v1",
        claims: contextState === "MISSING_CLAIMS" ? [] : [{
          key: "sample",
          value: sample.sampleId,
          source: "OWNER_DECISION",
          evidenceReference: `fixture:${sample.sampleId}`,
          verifiedAt: "2026-08-04T09:06:11.000Z",
        }],
      },
      candidate: {
        candidateId: sample.sampleId,
        objective: sample.summary,
        paths: sample.paths,
        revenueImpact: { monthlyKrw: 0, confidence: 1 },
        operatorMinutesSaved: 0,
        urgency: 0,
        dependencyReady: profile.dependencyReady ?? true,
      },
      pathPolicy,
      priorOutcome: profile.priorOutcome,
    },
    admission: {
      repository: profile.repository ?? fixture.repository,
      taskClass: sample.taskClass,
      paths: sample.paths,
      risk: profile.risk ?? "normal-risk",
      deliveryTarget: profile.deliveryTarget ?? "DRAFT_PR",
      paidCostKrw: profile.paidCostKrw ?? 0,
      dailyTasksStarted: profile.dailyTasksStarted ?? 0,
    },
    evaluatedAt: profile.evaluatedAt ?? "2026-08-05T00:00:00.000Z",
  });
}

test("owner-review fixture contains the exact balanced 60-case SHADOW sample", () => {
  const fixture = readFixture<ReviewFixture>(
    "docs/orchestrator/evidence/phase-5-shadow-owner-review.json",
  );
  assert.equal(fixture.schemaVersion, "1.0.0");
  assert.equal(fixture.repository, "gonggam-online/gonggamline-ai");
  assert.equal(fixture.policyVersion, "gonggamline-limited-autonomy-v1");
  assert.equal(fixture.labelStatus, "OWNER_REVIEWED");
  assert.equal(fixture.cases.length, 60);
  assert.equal(new Set(fixture.cases.map((sample) => sample.sampleId)).size, 60);
  for (const outcome of ["NEXT_TASK", "RETRY", "REPLAN"] as const) {
    assert.equal(
      fixture.cases.filter((sample) => sample.ownerDecision === outcome).length,
      20,
    );
  }
  assert.ok(fixture.cases.filter((sample) => sample.adversarial).length >= 15);
  assert.ok(fixture.cases.every(
    (sample) =>
      sample.summary.trim() &&
      sample.reason.trim() &&
      sample.paths.length > 0,
  ));
  assert.ok(fixture.cases.every((sample) => fixture.inputProfiles[sample.inputProfile]));
  assert.ok(fixture.cases.every((sample) => !("proposed" in sample)));
});

test("actual SHADOW and admission code independently reproduces all owner decisions", () => {
  const fixture = readFixture<ReviewFixture>(
    "docs/orchestrator/evidence/phase-5-shadow-owner-review.json",
  );
  const caps = readFixture<CapsFixture>(
    "docs/orchestrator/evidence/phase-5-approved-caps.json",
  );
  const generated = fixture.cases.map((sample) => ({
    sample,
    result: generatedOutcome(fixture, caps, sample),
  }));
  const evaluation = evaluateOwnerSample(fixture.cases.map((sample) => ({
    sampleId: sample.sampleId,
    proposed: generated.find((entry) => entry.sample.sampleId === sample.sampleId)?.result.outcome
      ?? "REPLAN",
    approved: sample.ownerDecision,
  })));
  assert.deepEqual(evaluation, {
    sampleSize: 60,
    exactMatch: 1,
    precision: { NEXT_TASK: 1, RETRY: 1, REPLAN: 1 },
    recall: { NEXT_TASK: 1, RETRY: 1, REPLAN: 1 },
  });
  assert.equal(generated.reduce((total, entry) => total + entry.result.dispatchOrExternalWrites, 0), 0);
  assert.equal(generated.filter(
    ({ sample, result }) =>
      sample.adversarial && sample.ownerDecision === "REPLAN" && result.outcome === "NEXT_TASK",
  ).length, 0);
});

test("approved caps are exact, zero-paid, unexpired, and hash-bound", () => {
  const caps = readFixture<CapsFixture>(
    "docs/orchestrator/evidence/phase-5-approved-caps.json",
  );
  assert.equal(caps.repository, "gonggam-online/gonggamline-ai");
  assert.equal(caps.perTaskTokenLimit, 100_000);
  assert.equal(caps.perTaskWallTimeMinutes, 120);
  assert.equal(caps.dailyTaskLimit, 1);
  assert.equal(caps.perTaskPaidCostKrw, 0);
  assert.equal(caps.dailyPaidCostKrw, 0);
  assert.equal(caps.expiresAt, "2026-09-04T14:59:59.000Z");
  assert.equal(caps.configHash, configHash(caps));
});

test("hermetic incident drill suppresses duplicates and preserves the audit chain", () => {
  const ledger = new OrchestratorLedger(":memory:", repositoryRoot);
  try {
    const now = "2026-08-04T10:00:00.000Z";
    ledger.registerProject("phase-5-drill", now);
    assert.equal(ledger.createTask({
      projectId: "phase-5-drill",
      taskId: "drill-task-001",
      parentTaskId: null,
      idempotencyKey: "phase-5-drill:task-001",
    }, now), "CREATED");
    assert.equal(ledger.createTask({
      projectId: "phase-5-drill",
      taskId: "drill-task-001",
      parentTaskId: null,
      idempotencyKey: "phase-5-drill:task-001",
    }, now), "EXISTS");
    const action = {
      actionScope: "SIMULATED_DRAFT_PR",
      idempotencyKey: "phase-5-drill:pr-001",
      payload: { repository: "gonggam-online/gonggamline-ai", externalWrite: false },
      now,
    };
    assert.equal(ledger.reserveAction(action), "RESERVED");
    assert.equal(ledger.reserveAction(action), "EXISTS");
    assert.equal(ledger.verifyAuditChain(), true);
  } finally {
    ledger.close();
  }
});

test("hermetic kill switch interrupts once and reconciles an owned process tree", async () => {
  let interrupts = 0;
  const guard = new BudgetGuard(
    { tokenLimit: 100_000, wallTimeSeconds: 7_200, estimatedCostKrwLimit: 0 },
    async () => { interrupts += 1; },
  );
  await assert.rejects(() => guard.observe({
    inputTokens: 100_001,
    outputTokens: 0,
    reasoningTokens: 0,
    estimatedCostKrw: 0,
    elapsedSeconds: 1,
  }), BudgetExceededError);
  assert.equal(interrupts, 1);

  const recovery = await interruptThenPlanRecovery({
    taskId: "drill-task-001",
    threadId: "thread-001",
    turnId: "turn-001",
    rootPid: 10,
    processes: [
      { pid: 10, parentPid: null, executable: "codex.cmd", taskId: "drill-task-001" },
      { pid: 11, parentPid: 10, executable: "node.exe", taskId: "drill-task-001" },
    ],
    appServer: {
      async interruptTurn() { return "missing"; },
    },
  });
  assert.deepEqual(recovery, {
    safeToStop: [11, 10],
    refused: [],
    reason: "OWNED_PROCESS_TREE",
  });
});

test("owner-reviewed evidence satisfies admission without authorizing final merge", () => {
  const caps = readFixture<CapsFixture>(
    "docs/orchestrator/evidence/phase-5-approved-caps.json",
  );
  const decision = evaluateLimitedAutonomyAdmission({
    version: "gonggamline-limited-autonomy-v1",
    approvedBy: caps.approvalReference,
    approvedAt: "2026-08-04T09:06:11.000Z",
    expiresAt: caps.expiresAt,
    policyHash: caps.configHash,
    repositories: [caps.repository],
    taskClasses: ["DOCUMENTATION", "TEST", "MONITORING", "BEHAVIOR_EQUIVALENT_INTERNAL_REFACTOR"],
    pathPolicy: { allowed: ["docs/**", "tests/**", "tools/orchestrator/**", ".codex/WORK_STATUS.md"], denied: ["supabase/**", "app/api/**", ".env*"] },
    caps: {
      perTaskTokenLimit: caps.perTaskTokenLimit,
      perTaskWallTimeMinutes: caps.perTaskWallTimeMinutes,
      perTaskPaidCostKrw: 0,
      dailyTaskLimit: caps.dailyTaskLimit,
      dailyPaidCostKrw: 0,
    },
    shadow: {
      ownerLabeled: true,
      sampleSize: 60,
      outcomeCounts: { NEXT_TASK: 20, RETRY: 20, REPLAN: 20 },
      adversarialCount: 15,
      forbiddenOrUnverifiedNextTaskFalsePositives: 0,
      generalNextTaskFalsePositives: 0,
      dispatchOrExternalWrites: 0,
      evaluation: {
        sampleSize: 60,
        exactMatch: 1,
        precision: { NEXT_TASK: 1, RETRY: 1, REPLAN: 1 },
        recall: { NEXT_TASK: 1, RETRY: 1, REPLAN: 1 },
      },
    },
    incidentDrill: {
      completed: true,
      duplicateSuppressed: true,
      inFlightWorkStopped: true,
      externalStateReconciled: true,
      killSwitchVerified: true,
      auditChainVerified: true,
      evidenceReference: "test:orchestrator-shadow-admission-evidence",
    },
  }, {
    repository: caps.repository,
    taskClass: "DOCUMENTATION",
    paths: ["docs/orchestrator/workflow.md"],
    risk: "normal-risk",
    deliveryTarget: "FINAL_MERGE",
    paidCostKrw: 0,
    dailyTasksStarted: 0,
  }, "2026-08-05T00:00:00.000Z");
  assert.equal(decision.authorized, false);
  assert.equal(decision.mode, "SHADOW");
  assert.ok(decision.reasons.includes(
    "Limited autonomy stops at a Draft PR and normal-risk delivery gates",
  ));
});
