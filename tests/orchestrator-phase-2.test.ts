import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  OrchestratorExecutionEngine,
  type RunVerifier,
  type WorkerAdapter,
  type WorkerOutcome,
} from "../tools/orchestrator/execution.ts";
import { FakeWorkerAdapter } from "../tools/orchestrator/fake-worker.ts";
import { OrchestratorLedger } from "../tools/orchestrator/ledger.ts";
import {
  runLocalVerification,
  verifyChangedPaths,
  type VerificationCommandId,
} from "../tools/orchestrator/verifier.ts";
import { inspectWorktree } from "../tools/orchestrator/worktree-guard.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const timestamp = "2026-07-29T09:00:00.000Z";
const passingVerifier: RunVerifier = (_repositoryRoot, commandIds) =>
  commandIds.map((commandId) => ({
    commandId: commandId as VerificationCommandId,
    exitCode: 0,
    durationMs: 1,
    outputHash: "a".repeat(64),
    passed: true,
  }));

function createFixture(): {
  readonly ledger: OrchestratorLedger;
  readonly directory: string;
} {
  const directory = mkdtempSync(path.join(tmpdir(), "orchestrator-phase-2-"));
  const ledger = new OrchestratorLedger(
    path.join(directory, "ledger.sqlite"),
    repositoryRoot,
  );
  ledger.registerProject("project-phase-2", timestamp);
  ledger.registerRepository({
    repositoryId: "gonggamline-ai",
    canonicalOrigin: "https://github.com/gonggam-online/gonggamline-ai-git.git",
    integrationBranch: "main",
    now: timestamp,
  });
  ledger.registerPc("N", "git,node,codex,sqlite", timestamp);
  ledger.createTask(
    {
      projectId: "project-phase-2",
      taskId: "task-phase-2",
      parentTaskId: null,
      idempotencyKey: "task:phase-2",
    },
    timestamp,
  );
  return { ledger, directory };
}

function request(runId: string, idempotencyKey: string) {
  return {
    projectId: "project-phase-2",
    taskId: "task-phase-2",
    runId,
    idempotencyKey,
    controllerId: "controller-N",
    leaseExpiresAt: "2026-07-29T09:30:00.000Z",
    now: () => timestamp,
    budget: {
      tokenLimit: 10_000,
      wallTimeSeconds: 300,
      estimatedCostKrwLimit: 1_000,
    },
    verificationPlan: {
      repositoryRoot,
      requiredCommandIds: ["GIT_DIFF_CHECK"],
      retryableOnFailure: true,
    },
  } as const;
}

test("run executes a safe worker and persists state, checkpoints, and evidence", async () => {
  const fixture = createFixture();
  try {
    const worker = new FakeWorkerAdapter(
      {
        kind: "SUCCEEDED",
        summary: "fixture documentation task completed",
        output: { changedFiles: ["docs/fixture.md"] },
        evidence: ["git:clean", "verify:passed"],
      },
      [{ checkpointKind: "FILE_WRITTEN", checkpointPayload: { path: "docs/fixture.md" } }],
    );
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => undefined,
      passingVerifier,
    );
    const result = await engine.execute(request("run-001", "run:001"));

    assert.equal(result.run.state, "COMPLETED");
    assert.equal(result.run.attempt, 1);
    assert.equal(result.outcome?.kind, "SUCCEEDED");
    assert.equal(fixture.ledger.runResult("run-001")?.outcome, "SUCCEEDED");
    const storedEvidence = fixture.ledger.runResult("run-001")?.evidence ?? [];
    assert.equal(
      storedEvidence.some((entry) =>
        entry.startsWith("verification:GIT_DIFF_CHECK:"),
      ),
      true,
    );
    assert.equal(storedEvidence.includes("verify:passed"), false);
    assert.equal(fixture.ledger.latestRunCheckpoint("run-001")?.kind, "FILE_WRITTEN");
    assert.equal(fixture.ledger.verifyAuditChain(), true);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("synchronous Worker execute throw fails closed as an adapter error", async () => {
  const fixture = createFixture();
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      {
        name: "synchronous-throw-worker",
        execute(): Promise<WorkerOutcome> {
          throw new Error("synthetic synchronous Worker throw");
        },
      },
      async () => undefined,
      passingVerifier,
    );
    const completed = await engine.execute(
      request("run-worker-sync-throw", "run:worker-sync-throw"),
    );
    const stored = fixture.ledger.runResult("run-worker-sync-throw");
    assert.equal(completed.run.state, "RETRYABLE_FAILURE");
    assert.equal(
      fixture.ledger.taskState("task-phase-2"),
      "RETRYABLE_FAILURE",
    );
    assert.notEqual(completed.run.state, "RUNNING");
    assert.equal(stored?.failureCode, "WORKER_ADAPTER_ERROR");
    assert.deepEqual(stored?.evidence, ["controller:worker-adapter-error"]);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("asynchronous Worker execute rejection keeps the adapter fail-close path", async () => {
  const fixture = createFixture();
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      {
        name: "asynchronous-reject-worker",
        async execute(): Promise<WorkerOutcome> {
          throw new Error("synthetic asynchronous Worker rejection");
        },
      },
      async () => undefined,
      passingVerifier,
    );
    const completed = await engine.execute(
      request("run-worker-async-reject", "run:worker-async-reject"),
    );
    const stored = fixture.ledger.runResult("run-worker-async-reject");
    assert.equal(completed.run.state, "RETRYABLE_FAILURE");
    assert.equal(
      fixture.ledger.taskState("task-phase-2"),
      "RETRYABLE_FAILURE",
    );
    assert.equal(stored?.failureCode, "WORKER_ADAPTER_ERROR");
    assert.deepEqual(stored?.evidence, ["controller:worker-adapter-error"]);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Worker success cannot complete when a required verifier fails", async () => {
  const fixture = createFixture();
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      new FakeWorkerAdapter({
        kind: "SUCCEEDED",
        summary: "unverified worker success",
        output: { candidate: true },
        evidence: ["worker:self-asserted-pass"],
      }),
      async () => undefined,
      (_repositoryRoot, commandIds) =>
        commandIds.map((commandId) => ({
          commandId: commandId as VerificationCommandId,
          exitCode: 1,
          durationMs: 1,
          outputHash: "b".repeat(64),
          passed: false,
        })),
    );
    const result = await engine.execute(
      request("run-verifier-failed", "run:verifier-failed"),
    );
    assert.equal(result.run.state, "RETRYABLE_FAILURE");
    assert.equal(
      fixture.ledger.taskState("task-phase-2"),
      "RETRYABLE_FAILURE",
    );
    assert.equal(
      fixture.ledger.runResult("run-verifier-failed")?.failureCode,
      "VERIFICATION_FAILED",
    );
    assert.equal(
      fixture.ledger
        .runResult("run-verifier-failed")
        ?.evidence.includes("worker:self-asserted-pass"),
      false,
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("Worker success cannot complete without a required verification plan", async () => {
  const fixture = createFixture();
  let verifierCalls = 0;
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      new FakeWorkerAdapter({
        kind: "SUCCEEDED",
        summary: "missing plan",
        output: {},
        evidence: ["worker:self-asserted-pass"],
      }),
      async () => undefined,
      () => {
        verifierCalls += 1;
        return [];
      },
    );
    const withoutPlan = { ...request(
      "run-no-verification",
      "run:no-verification",
    ) };
    delete (withoutPlan as { verificationPlan?: unknown }).verificationPlan;
    const result = await engine.execute(withoutPlan);
    assert.equal(result.run.state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(verifierCalls, 0);
    assert.equal(
      fixture.ledger.runResult("run-no-verification")?.failureCode,
      "VERIFICATION_NOT_RUN",
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("run idempotency prevents duplicate worker dispatch", async () => {
  const fixture = createFixture();
  let dispatches = 0;
  const worker: WorkerAdapter = {
    name: "counting-safe-worker",
    async execute(): Promise<WorkerOutcome> {
      dispatches += 1;
      return {
        kind: "SUCCEEDED",
        summary: "done",
        output: {},
        evidence: [],
      };
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => undefined,
      passingVerifier,
    );
    await engine.execute(request("run-idempotent", "run:idempotent"));
    const duplicate = await engine.execute(
      request("run-idempotent", "run:idempotent"),
    );
    assert.equal(dispatches, 1);
    assert.equal(duplicate.outcome, null);
    assert.equal(duplicate.run.state, "COMPLETED");
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("engine selects the next READY task deterministically", async () => {
  const fixture = createFixture();
  try {
    fixture.ledger.transition("task-phase-2", "READY", timestamp);
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      new FakeWorkerAdapter({
        kind: "SUCCEEDED",
        summary: "selected ready task",
        output: {},
        evidence: ["selection:ready"],
      }),
      async () => undefined,
      passingVerifier,
    );
    const result = await engine.executeNextReady({
      ...request("run-selected", "run:selected"),
      runId: "run-selected",
      idempotencyKey: "run:selected",
    });
    assert.equal(result?.run.taskId, "task-phase-2");
    assert.equal(result?.run.state, "COMPLETED");
    assert.equal(
      await engine.executeNextReady({
        ...request("run-none", "run:none"),
        runId: "run-none",
        idempotencyKey: "run:none",
      }),
      null,
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("retry preserves retryOfRunId and increments the attempt", async () => {
  const fixture = createFixture();
  let attempt = 0;
  const worker: WorkerAdapter = {
    name: "retry-safe-worker",
    async execute(): Promise<WorkerOutcome> {
      attempt += 1;
      return attempt === 1
        ? {
            kind: "FAILED",
            summary: "transient fixture failure",
            errorCode: "TRANSIENT",
            retryable: true,
            evidence: ["fixture:failure"],
          }
        : {
            kind: "SUCCEEDED",
            summary: "fixture recovered",
            output: { recovered: true },
            evidence: ["fixture:recovered"],
          };
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => undefined,
      passingVerifier,
    );
    const first = await engine.execute(request("run-failed", "run:failed"));
    assert.equal(first.run.state, "RETRYABLE_FAILURE");
    const retry = await engine.retry("run-failed", {
      ...request("run-retry", "run:retry"),
      runId: "run-retry",
    });
    assert.equal(retry.run.state, "COMPLETED");
    assert.equal(retry.run.retryOfRunId, "run-failed");
    assert.equal(retry.run.attempt, 2);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("retry ceiling makes both run and task permanently FAILED", async () => {
  const fixture = createFixture();
  const worker = new FakeWorkerAdapter({
    kind: "FAILED",
    summary: "repeatable fixture failure",
    errorCode: "REPEATABLE",
    retryable: true,
    evidence: ["fixture:repeatable"],
  });
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => undefined,
      passingVerifier,
    );
    await engine.execute(request("run-ceiling-1", "run:ceiling:1"));
    await engine.retry("run-ceiling-1", {
      ...request("run-ceiling-2", "run:ceiling:2"),
      runId: "run-ceiling-2",
    });
    await engine.retry("run-ceiling-2", {
      ...request("run-ceiling-3", "run:ceiling:3"),
      runId: "run-ceiling-3",
    });
    await assert.rejects(
      () =>
        engine.retry("run-ceiling-3", {
          ...request("run-ceiling-4", "run:ceiling:4"),
          runId: "run-ceiling-4",
        }),
      /retry ceiling exhausted/,
    );
    assert.equal(fixture.ledger.run("run-ceiling-3").state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("approval wait is distinct and can resume from its persisted checkpoint", async () => {
  const fixture = createFixture();
  let dispatches = 0;
  let resumedSequence: number | null = null;
  const worker: WorkerAdapter = {
    name: "approval-safe-worker",
    async execute(context): Promise<WorkerOutcome> {
      dispatches += 1;
      if (dispatches === 1) {
        return {
          kind: "WAITING_FOR_HUMAN",
          summary: "owner action required",
          approvalReason: "FINAL_PR_MERGE",
          evidence: ["approval:exact-action"],
        };
      }
      resumedSequence = context.resumedFrom?.sequence ?? null;
      return {
        kind: "SUCCEEDED",
        summary: "resumed safely",
        output: { approved: true },
        evidence: ["approval:recorded"],
      };
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => undefined,
      passingVerifier,
    );
    const waiting = await engine.execute(request("run-approval", "run:approval"));
    assert.equal(waiting.run.state, "WAITING_FOR_HUMAN");
    assert.equal(fixture.ledger.runResult("run-approval"), null);
    const resumed = await engine.resume("run-approval", {
      projectId: "project-phase-2",
      controllerId: "controller-N",
      leaseExpiresAt: "2026-07-29T09:30:00.000Z",
      now: () => timestamp,
      budget: request("unused", "unused").budget,
      verificationPlan: request("unused", "unused").verificationPlan,
    });
    assert.equal(resumed.run.state, "COMPLETED");
    assert.notEqual(resumedSequence, null);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("budget failure interrupts once and cannot become success", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  const worker: WorkerAdapter = {
    name: "usage-safe-worker",
    async execute(_context, hooks): Promise<WorkerOutcome> {
      await hooks.observeUsage({
        inputTokens: 101,
        outputTokens: 0,
        reasoningTokens: 0,
        estimatedCostKrw: 0,
        elapsedSeconds: 1,
      });
      return {
        kind: "SUCCEEDED",
        summary: "must not be reached",
        output: {},
        evidence: [],
      };
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => {
        interrupts += 1;
      },
      passingVerifier,
    );
    const result = await engine.execute({
      ...request("run-budget", "run:budget"),
      budget: {
        tokenLimit: 100,
        wallTimeSeconds: 300,
        estimatedCostKrwLimit: 1_000,
      },
    });
    assert.equal(interrupts, 1);
    assert.equal(result.run.state, "FAILED");
    assert.equal(fixture.ledger.runResult("run-budget")?.failureCode, "TOKENS");
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("controller preserves a caught usage breach over Worker and verifier success", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  let verifierCalls = 0;
  const worker: WorkerAdapter = {
    name: "budget-catching-worker",
    async execute(_context, hooks): Promise<WorkerOutcome> {
      try {
        await hooks.observeUsage({
          inputTokens: 101,
          outputTokens: 0,
          reasoningTokens: 0,
          estimatedCostKrw: 0,
          elapsedSeconds: 1,
        });
      } catch {
        // A Worker cannot erase the controller-owned budget breach.
      }
      return {
        kind: "SUCCEEDED",
        summary: "worker ignored budget breach",
        output: { unsafeSuccess: true },
        evidence: ["worker:self-asserted-success"],
      };
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => {
        interrupts += 1;
      },
      (_repositoryRoot, commandIds) => {
        verifierCalls += 1;
        return passingVerifier(_repositoryRoot, commandIds);
      },
    );
    const result = await engine.execute({
      ...request("run-caught-budget", "run:caught-budget"),
      budget: {
        tokenLimit: 100,
        wallTimeSeconds: 300,
        estimatedCostKrwLimit: 1_000,
      },
    });
    const stored = fixture.ledger.runResult("run-caught-budget");
    assert.equal(result.run.state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(interrupts, 1);
    assert.equal(verifierCalls, 0);
    assert.equal(stored?.failureCode, "TOKENS");
    assert.deepEqual(stored?.evidence, ["controller:budget-exceeded:TOKENS"]);
    assert.equal(stored?.evidence.includes("worker:self-asserted-success"), false);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("wall-clock timeout stops a Worker that never reports usage", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  const worker: WorkerAdapter = {
    name: "hanging-safe-worker",
    async execute(): Promise<WorkerOutcome> {
      return new Promise<WorkerOutcome>(() => undefined);
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => {
        interrupts += 1;
      },
      passingVerifier,
    );
    const result = await engine.execute({
      ...request("run-wall-timeout", "run:wall-timeout"),
      budget: {
        tokenLimit: 1_000,
        wallTimeSeconds: 0.01,
        estimatedCostKrwLimit: 1_000,
      },
    });
    assert.equal(result.run.state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(interrupts, 1);
    assert.equal(
      fixture.ledger.runResult("run-wall-timeout")?.failureCode,
      "WALL_TIME_TIMEOUT",
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("wall-clock timeout does not await a permanently pending interrupt", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      {
        name: "hanging-worker-and-interrupt",
        async execute(): Promise<WorkerOutcome> {
          return new Promise<WorkerOutcome>(() => undefined);
        },
      },
      async () => {
        interrupts += 1;
        return new Promise<void>(() => undefined);
      },
      passingVerifier,
    );
    const completed = await Promise.race([
      engine.execute({
        ...request("run-pending-interrupt", "run:pending-interrupt"),
        budget: {
          tokenLimit: 1_000,
          wallTimeSeconds: 0.005,
          estimatedCostKrwLimit: 1_000,
        },
      }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("execute did not terminate")), 250);
      }),
    ]);
    assert.equal(completed.run.state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(interrupts, 1);
    assert.equal(
      fixture.ledger.runResult("run-pending-interrupt")?.failureCode,
      "WALL_TIME_TIMEOUT",
    );
    assert.deepEqual(
      fixture.ledger.runResult("run-pending-interrupt")?.evidence,
      ["controller:wall-clock-timeout"],
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("wall-clock timeout survives interrupt rejection and ignores late success", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      {
        name: "late-worker-rejected-interrupt",
        async execute(): Promise<WorkerOutcome> {
          return new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  kind: "SUCCEEDED",
                  summary: "late success",
                  output: {},
                  evidence: ["worker:late-after-rejected-interrupt"],
                }),
              50,
            );
          });
        },
      },
      async () => {
        interrupts += 1;
        throw new Error("synthetic interrupt rejection");
      },
      passingVerifier,
    );
    await engine.execute({
      ...request("run-rejected-interrupt", "run:rejected-interrupt"),
      budget: {
        tokenLimit: 1_000,
        wallTimeSeconds: 0.005,
        estimatedCostKrwLimit: 1_000,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const stored = fixture.ledger.runResult("run-rejected-interrupt");
    assert.equal(fixture.ledger.run("run-rejected-interrupt").state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(interrupts, 1);
    assert.equal(stored?.failureCode, "WALL_TIME_TIMEOUT");
    assert.deepEqual(stored?.evidence, ["controller:wall-clock-timeout"]);
    assert.equal(
      stored?.evidence.includes("worker:late-after-rejected-interrupt"),
      false,
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("wall-clock timeout survives synchronous interrupt throw and ignores late hooks", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      {
        name: "late-worker-sync-throw-interrupt",
        async execute(_context, hooks): Promise<WorkerOutcome> {
          return new Promise((resolve) => {
            setTimeout(() => {
              hooks.checkpoint({
                kind: "LATE_CHECKPOINT",
                payload: { ignored: true },
              });
              resolve({
                kind: "SUCCEEDED",
                summary: "late success",
                output: {},
                evidence: ["worker:late-after-sync-throw"],
              });
            }, 50);
          });
        },
      },
      () => {
        interrupts += 1;
        throw new Error("synthetic synchronous interrupt throw");
      },
      passingVerifier,
    );
    const completed = await engine.execute({
      ...request("run-sync-throw-interrupt", "run:sync-throw-interrupt"),
      budget: {
        tokenLimit: 1_000,
        wallTimeSeconds: 0.005,
        estimatedCostKrwLimit: 1_000,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const stored = fixture.ledger.runResult("run-sync-throw-interrupt");
    assert.equal(completed.run.state, "FAILED");
    assert.equal(
      fixture.ledger.run("run-sync-throw-interrupt").state,
      "FAILED",
    );
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(interrupts, 1);
    assert.equal(stored?.failureCode, "WALL_TIME_TIMEOUT");
    assert.deepEqual(stored?.evidence, ["controller:wall-clock-timeout"]);
    assert.equal(
      stored?.evidence.includes("worker:late-after-sync-throw"),
      false,
    );
    assert.equal(
      fixture.ledger.latestRunCheckpoint("run-sync-throw-interrupt")?.kind,
      "INTERRUPT_BOUNDARY",
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("late Worker success after timeout is ignored without a second transition", async () => {
  const fixture = createFixture();
  let interrupts = 0;
  const worker: WorkerAdapter = {
    name: "late-safe-worker",
    async execute(): Promise<WorkerOutcome> {
      return new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              kind: "SUCCEEDED",
              summary: "too late",
              output: { late: true },
              evidence: ["worker:late-success"],
            }),
          50,
        );
      });
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => {
        interrupts += 1;
      },
      passingVerifier,
    );
    await engine.execute({
      ...request("run-late-timeout", "run:late-timeout"),
      budget: {
        tokenLimit: 1_000,
        wallTimeSeconds: 0.005,
        estimatedCostKrwLimit: 1_000,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(fixture.ledger.run("run-late-timeout").state, "FAILED");
    assert.equal(fixture.ledger.taskState("task-phase-2"), "FAILED");
    assert.equal(interrupts, 1);
    assert.equal(
      fixture.ledger.runResult("run-late-timeout")?.failureCode,
      "WALL_TIME_TIMEOUT",
    );
    assert.equal(
      fixture.ledger
        .runResult("run-late-timeout")
        ?.evidence.includes("worker:late-success"),
      false,
    );
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("checkpoint and result persistence redact synthetic secret material", async () => {
  const fixture = createFixture();
  const worker: WorkerAdapter = {
    name: "redaction-safe-worker",
    async execute(_context, hooks): Promise<WorkerOutcome> {
      hooks.checkpoint({
        kind: "SYNTHETIC_SECRET_PROBE",
        payload: {
          password: "synthetic-password",
          message: "Bearer synthetic-access-token",
        },
      });
      return {
        kind: "SUCCEEDED",
        summary: "api_key=synthetic-api-key",
        output: { secret: "synthetic-output-secret" },
        evidence: ["token=synthetic-evidence-token"],
      };
    },
  };
  try {
    const engine = new OrchestratorExecutionEngine(
      fixture.ledger,
      worker,
      async () => undefined,
      passingVerifier,
    );
    await engine.execute(request("run-redaction", "run:redaction"));
    const checkpoint = JSON.stringify(
      fixture.ledger.latestRunCheckpoint("run-redaction"),
    );
    const result = JSON.stringify(fixture.ledger.runResult("run-redaction"));
    assert.equal(checkpoint.includes("synthetic-password"), false);
    assert.equal(checkpoint.includes("synthetic-access-token"), false);
    assert.equal(result.includes("synthetic-api-key"), false);
    assert.equal(result.includes("synthetic-evidence-token"), false);
    assert.match(checkpoint, /\[redacted\]/);
    assert.match(result, /\[redacted\]/);
  } finally {
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("worktree guard verifies exact origin, SHA, clean state, and unique branch", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "orchestrator-worktree-"));
  try {
    execFileSync("git", ["init", "-b", "main", directory]);
    execFileSync("git", ["-C", directory, "config", "user.name", "Fixture"]);
    execFileSync("git", ["-C", directory, "config", "user.email", "fixture@example.invalid"]);
    execFileSync("git", [
      "-C",
      directory,
      "remote",
      "add",
      "origin",
      "https://github.com/example/fixture.git",
    ]);
    writeFileSync(path.join(directory, "README.md"), "# fixture\n", "utf8");
    execFileSync("git", ["-C", directory, "add", "README.md"]);
    execFileSync("git", ["-C", directory, "commit", "-m", "fixture"]);
    const sha = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();

    const evidence = inspectWorktree({
      repositoryRoot: directory,
      canonicalOrigin: "https://github.com/example/fixture.git",
      baseSha: sha,
      branch: "main",
    });
    assert.equal(evidence.clean, true);
    assert.equal(evidence.branchCheckoutCount, 1);

    writeFileSync(path.join(directory, "dirty.txt"), "dirty\n", "utf8");
    assert.throws(
      () =>
        inspectWorktree({
          repositoryRoot: directory,
          canonicalOrigin: "https://github.com/example/fixture.git",
          baseSha: sha,
          branch: "main",
        }),
      /uncommitted changes/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("local verifier stores hashes and rejects every unapproved command path", () => {
  let processRuns = 0;
  const evidence = runLocalVerification(
    repositoryRoot,
    ["GIT_DIFF_CHECK"],
    () => {
      processRuns += 1;
      return {
        status: 0,
        stdout: "safe fixture",
        stderr: "",
        timedOut: false,
      };
    },
  );
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.passed, true);
  assert.match(evidence[0]?.outputHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(processRuns, 1);

  for (const commandId of [
    "NODE_NETWORK_SCRIPT",
    "NPM_INSTALL",
    "NPX_EXTERNAL_SCRIPT",
    "GIT_PUSH",
    "POWERSHELL_NETWORK",
    "PYTHON_NETWORK",
    "ARBITRARY_EXECUTABLE",
  ]) {
    assert.throws(
      () =>
        runLocalVerification(repositoryRoot, [commandId], () => {
          processRuns += 1;
          return { status: 0, stdout: "", stderr: "", timedOut: false };
        }),
      /not approved/,
    );
  }
  assert.equal(processRuns, 1);
});

test("verifier child environment excludes credentials and secret variables", () => {
  const priorToken = process.env.SYNTHETIC_SECRET_TOKEN;
  const priorGithub = process.env.GITHUB_TOKEN;
  process.env.SYNTHETIC_SECRET_TOKEN = "synthetic-secret";
  process.env.GITHUB_TOKEN = "synthetic-github-token";
  let childEnvironment: Readonly<Record<string, string>> | null = null;
  try {
    runLocalVerification(repositoryRoot, ["GIT_DIFF_CHECK"], (invocation) => {
      childEnvironment = invocation.env;
      return { status: 0, stdout: "", stderr: "", timedOut: false };
    });
  } finally {
    if (priorToken === undefined) {
      delete process.env.SYNTHETIC_SECRET_TOKEN;
    } else {
      process.env.SYNTHETIC_SECRET_TOKEN = priorToken;
    }
    if (priorGithub === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = priorGithub;
    }
  }
  assert.notEqual(childEnvironment, null);
  assert.equal("SYNTHETIC_SECRET_TOKEN" in childEnvironment!, false);
  assert.equal("GITHUB_TOKEN" in childEnvironment!, false);
  assert.equal("NODE_OPTIONS" in childEnvironment!, false);
});

test("diff verifier applies allow and deny paths to tracked and untracked files", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "orchestrator-diff-"));
  try {
    execFileSync("git", ["init", "-b", "main", directory]);
    execFileSync("git", ["-C", directory, "config", "user.name", "Fixture"]);
    execFileSync("git", ["-C", directory, "config", "user.email", "fixture@example.invalid"]);
    writeFileSync(path.join(directory, "README.md"), "# fixture\n", "utf8");
    execFileSync("git", ["-C", directory, "add", "README.md"]);
    execFileSync("git", ["-C", directory, "commit", "-m", "fixture"]);
    const sha = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();

    const docsDirectory = path.join(directory, "docs");
    mkdirSync(docsDirectory);
    writeFileSync(path.join(docsDirectory, "safe.md"), "safe\n", "utf8");
    const evidence = verifyChangedPaths(directory, sha, {
      allowed: ["docs/**"],
      denied: ["docs/secrets/**"],
    });
    assert.deepEqual(evidence.changedPaths, ["docs/safe.md"]);

    const secretDirectory = path.join(docsDirectory, "secrets");
    mkdirSync(secretDirectory);
    writeFileSync(path.join(secretDirectory, "blocked.md"), "blocked\n", "utf8");
    assert.throws(
      () =>
        verifyChangedPaths(directory, sha, {
          allowed: ["docs/**"],
          denied: ["docs/secrets/**"],
        }),
      /DENIED/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("vertical slice dispatches a documentation worker to a verified local commit", async () => {
  const fixtureRepository = mkdtempSync(
    path.join(tmpdir(), "orchestrator-vertical-repo-"),
  );
  const ledgerDirectory = mkdtempSync(
    path.join(tmpdir(), "orchestrator-vertical-ledger-"),
  );
  const ledger = new OrchestratorLedger(
    path.join(ledgerDirectory, "ledger.sqlite"),
    fixtureRepository,
  );
  try {
    execFileSync("git", ["init", "-b", "main", fixtureRepository]);
    execFileSync("git", ["-C", fixtureRepository, "config", "user.name", "Fixture"]);
    execFileSync("git", [
      "-C",
      fixtureRepository,
      "config",
      "user.email",
      "fixture@example.invalid",
    ]);
    execFileSync("git", [
      "-C",
      fixtureRepository,
      "remote",
      "add",
      "origin",
      "https://github.com/example/fixture.git",
    ]);
    writeFileSync(path.join(fixtureRepository, "README.md"), "# fixture\n", "utf8");
    execFileSync("git", ["-C", fixtureRepository, "add", "README.md"]);
    execFileSync("git", ["-C", fixtureRepository, "commit", "-m", "fixture base"]);
    const baseSha = execFileSync(
      "git",
      ["-C", fixtureRepository, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    inspectWorktree({
      repositoryRoot: fixtureRepository,
      canonicalOrigin: "https://github.com/example/fixture.git",
      baseSha,
      branch: "main",
    });

    ledger.registerProject("vertical-project", timestamp);
    ledger.registerRepository({
      repositoryId: "fixture",
      canonicalOrigin: "https://github.com/example/fixture.git",
      integrationBranch: "main",
      now: timestamp,
    });
    ledger.registerPc("N", "git,node,sqlite", timestamp);
    ledger.createTask(
      {
        projectId: "vertical-project",
        taskId: "vertical-task",
        parentTaskId: null,
        idempotencyKey: "task:vertical",
      },
      timestamp,
    );

    const worker: WorkerAdapter = {
      name: "fixture-documentation-worker",
      async execute(_context, hooks): Promise<WorkerOutcome> {
        const docsDirectory = path.join(fixtureRepository, "docs");
        mkdirSync(docsDirectory);
        writeFileSync(
          path.join(docsDirectory, "phase-2.md"),
          "# verified fixture\n",
          "utf8",
        );
        hooks.checkpoint({
          kind: "DOCUMENT_WRITTEN",
          payload: { path: "docs/phase-2.md" },
        });
        const paths = verifyChangedPaths(fixtureRepository, baseSha, {
          allowed: ["docs/**"],
          denied: [],
        });
        const verification = runLocalVerification(fixtureRepository, [
          "GIT_DIFF_CHECK",
        ]);
        assert.equal(verification.every((entry) => entry.passed), true);
        execFileSync("git", ["-C", fixtureRepository, "add", "docs/phase-2.md"]);
        execFileSync("git", [
          "-C",
          fixtureRepository,
          "commit",
          "-m",
          "docs: verify phase 2 fixture",
        ]);
        const commitSha = execFileSync(
          "git",
          ["-C", fixtureRepository, "rev-parse", "HEAD"],
          { encoding: "utf8" },
        ).trim();
        return {
          kind: "SUCCEEDED",
          summary: "documentation fixture committed",
          output: { commitSha },
          evidence: [
            `paths:${paths.changedPaths.length}`,
            `verify:${verification[0]?.outputHash ?? "missing"}`,
            `commit:${commitSha}`,
          ],
        };
      },
    };
    const engine = new OrchestratorExecutionEngine(
      ledger,
      worker,
      async () => undefined,
    );
    const result = await engine.execute({
      projectId: "vertical-project",
      taskId: "vertical-task",
      runId: "vertical-run",
      idempotencyKey: "run:vertical",
      controllerId: "controller-N",
      leaseExpiresAt: "2026-07-29T09:30:00.000Z",
      now: () => timestamp,
      budget: {
        tokenLimit: 1_000,
        wallTimeSeconds: 60,
        estimatedCostKrwLimit: 0,
      },
      verificationPlan: {
        repositoryRoot: fixtureRepository,
        requiredCommandIds: ["GIT_DIFF_CHECK"],
        retryableOnFailure: true,
      },
    });
    assert.equal(result.run.state, "COMPLETED");
    assert.equal(
      execFileSync(
        "git",
        ["-C", fixtureRepository, "status", "--porcelain=v1"],
        { encoding: "utf8" },
      ).trim(),
      "",
    );
    assert.notEqual(
      execFileSync(
        "git",
        ["-C", fixtureRepository, "rev-parse", "HEAD"],
        { encoding: "utf8" },
      ).trim(),
      baseSha,
    );
  } finally {
    ledger.close();
    rmSync(fixtureRepository, { recursive: true, force: true });
    rmSync(ledgerDirectory, { recursive: true, force: true });
  }
});
