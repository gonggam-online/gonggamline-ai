import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";

import {
  AppServerWorkerAdapter,
  type AppServerLauncher,
  type AppServerProcess,
} from "../tools/orchestrator/app-server-worker.ts";
import { runDevelopmentLoop } from "../tools/orchestrator/development-loop.ts";
import {
  OrchestratorExecutionEngine,
  type RunExecutionRequest,
  type WorkerExecutionContext,
  type WorkerHooks,
  type WorkerOutcome,
} from "../tools/orchestrator/execution.ts";
import { OrchestratorLedger } from "../tools/orchestrator/ledger.ts";
import type { VerificationCommandId } from "../tools/orchestrator/verifier.ts";
import {
  inspectExecutionWorkspace,
  type WorkspaceBoundary,
} from "../tools/orchestrator/workspace-boundary.ts";

const timestamp = "2026-07-30T09:00:00.000Z";
const canonicalOrigin =
  "https://github.com/gonggam-online/gonggamline-ai.git";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function createRepository(): {
  readonly directory: string;
  readonly boundary: WorkspaceBoundary;
} {
  const directory = mkdtempSync(path.join(tmpdir(), "orchestrator-phase-3-"));
  git(directory, ["init", "-b", "codex/test/phase-3"]);
  git(directory, ["config", "user.email", "phase3@example.invalid"]);
  git(directory, ["config", "user.name", "Phase 3 Test"]);
  git(directory, ["remote", "add", "origin", canonicalOrigin]);
  mkdirSync(path.join(directory, "docs"));
  writeFileSync(path.join(directory, "docs", "fixture.md"), "before\n");
  git(directory, ["add", "docs/fixture.md"]);
  git(directory, ["commit", "-m", "test: initialize fixture"]);
  return {
    directory,
    boundary: {
      repositoryRoot: directory,
      canonicalOrigin,
      branch: "codex/test/phase-3",
      baseSha: git(directory, ["rev-parse", "HEAD"]),
      pathPolicy: {
        allowed: ["docs/**"],
        denied: [".env*", ".git/**"],
      },
    },
  };
}

function context(attempt = 1): WorkerExecutionContext {
  return {
    taskId: "task-phase-3",
    runId: `run-phase-3-${attempt}`,
    attempt,
    retryOfRunId: attempt === 1 ? null : `run-phase-3-${attempt - 1}`,
    resumedFrom: null,
    priorFailure:
      attempt === 1
        ? null
        : { code: "VERIFICATION_FAILED", evidence: ["verification:failed"] },
  };
}

function hooks(): WorkerHooks {
  return {
    checkpoint: () => undefined,
    observeUsage: async () => undefined,
  };
}

interface FakeServerOptions {
  readonly onTurn?: () => void;
  readonly onRequest?: (method: string) => void;
  readonly finalText?: string;
  readonly malformedEvent?: boolean;
  readonly duplicateTerminal?: boolean;
  readonly suppressTerminal?: boolean;
  readonly completionItemOnly?: boolean;
  readonly ignoreStdinEnd?: boolean;
  readonly terminationBehavior?: "exit" | "reject" | "pending" | "throw";
  readonly onTerminate?: () => void;
  readonly usageInputTokens?: number;
  readonly usageOutputTokens?: number;
  readonly usageReasoningTokens?: number;
  readonly usageTotalTokens?: number;
}

class FakeAppServerProcess extends EventEmitter implements AppServerProcess {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin: Writable;
  terminationCalls = 0;
  #options: FakeServerOptions;

  constructor(options: FakeServerOptions) {
    super();
    this.#options = options;
    this.stdin = new Writable({
      write: (chunk, _encoding, callback) => {
        const request = JSON.parse(String(chunk).trim()) as {
          id?: number;
          method: string;
        };
        options.onRequest?.(request.method);
        if (options.malformedEvent && request.method === "initialize") {
          this.stdout.write("not-json\n");
          callback();
          return;
        }
        if (request.id === undefined) {
          callback();
          return;
        }
        let result: unknown = {};
        if (request.method === "thread/start") {
          result = { thread: { id: "thread-phase-3" } };
        }
        if (request.method === "turn/start") {
          result = { turn: { id: "turn-phase-3" } };
        }
        this.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
        if (request.method === "turn/start") {
          options.onTurn?.();
          if (options.usageInputTokens !== undefined) {
            this.stdout.write(
              `${JSON.stringify({
                method: "thread/tokenUsage/updated",
                params: {
                  tokenUsage: {
                    total: {
                      totalTokens: options.usageTotalTokens,
                      inputTokens: options.usageInputTokens,
                      outputTokens: options.usageOutputTokens ?? 0,
                      reasoningOutputTokens:
                        options.usageReasoningTokens ?? 0,
                    },
                  },
                },
              })}\n`,
            );
          }
          const finalText =
            options.finalText ??
            JSON.stringify({
              kind: "SUCCEEDED",
              summary: "safe fixture edit completed",
              errorCode: "",
              retryable: false,
              approvalReason: "",
              evidence: ["worker:informational"],
            });
          const terminal = JSON.stringify({
            method: "turn/completed",
            params: {
              turn: {
                status: "completed",
                items: options.completionItemOnly
                  ? []
                  : [{ type: "agentMessage", text: finalText }],
              },
            },
          });
          if (!options.suppressTerminal) {
            setImmediate(() => {
              if (options.completionItemOnly) {
                this.stdout.write(
                  `${JSON.stringify({
                    method: "item/completed",
                    params: {
                      threadId: "thread-phase-3",
                      turnId: "turn-phase-3",
                      completedAtMs: Date.now(),
                      item: { type: "agentMessage", text: finalText },
                    },
                  })}\n`,
                );
              }
              this.stdout.write(`${terminal}\n`);
              if (options.duplicateTerminal) {
                this.stdout.write(`${terminal}\n`);
              }
            });
          }
        }
        callback();
      },
      final: (callback) => {
        if (!options.ignoreStdinEnd) {
          setImmediate(() => this.emit("exit", 0));
        }
        callback();
      },
    });
  }

  terminate(): boolean | Promise<boolean> {
    this.terminationCalls += 1;
    this.#options.onTerminate?.();
    switch (this.#options.terminationBehavior ?? "exit") {
      case "throw":
        throw new Error("synthetic synchronous termination throw");
      case "reject":
        return Promise.reject(
          new Error("synthetic asynchronous termination rejection"),
        );
      case "pending":
        return new Promise<boolean>(() => undefined);
      case "exit":
        setImmediate(() => this.emit("exit", 137));
        return true;
    }
  }
}

test("App Server transport completes only inside the approved workspace", async () => {
  const fixture = createRepository();
  try {
    const launcher: AppServerLauncher = () =>
      new FakeAppServerProcess({
        onTurn: () =>
          writeFileSync(
            path.join(fixture.directory, "docs", "fixture.md"),
            "after\n",
          ),
        duplicateTerminal: true,
      });
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Update the approved fixture documentation",
        correlationId: "correlation-phase-3",
        workspace: fixture.boundary,
      },
      launcher,
    );
    const outcome = await adapter.execute(context(), hooks());

    assert.equal(outcome.kind, "SUCCEEDED");
    assert.equal(
      readFileSync(path.join(fixture.directory, "docs", "fixture.md"), "utf8"),
      "after\n",
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("App Server budget uses protocol totalTokens without double-counting reasoning", async () => {
  const fixture = createRepository();
  const observations: Array<{
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens?: number;
  }> = [];
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Return structured success",
        correlationId: "correlation-token-accounting",
        workspace: fixture.boundary,
      },
      () =>
        new FakeAppServerProcess({
          usageInputTokens: 80,
          usageOutputTokens: 20,
          usageReasoningTokens: 15,
          usageTotalTokens: 100,
        }),
    );
    const outcome = await adapter.execute(context(), {
      checkpoint: () => undefined,
      observeUsage: async (usage) => {
        observations.push(usage);
      },
    });

    assert.equal(outcome.kind, "SUCCEEDED");
    assert.deepEqual(observations, [
      {
        inputTokens: 80,
        outputTokens: 20,
        reasoningTokens: 15,
        totalTokens: 100,
        estimatedCostKrw: 0,
        elapsedSeconds: 0,
      },
    ]);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("transport rejects malformed JSONL without accepting success", async () => {
  const fixture = createRepository();
  const checkpoints: Array<{ kind: string; payload: unknown }> = [];
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Do not run",
        correlationId: "correlation-malformed",
        workspace: fixture.boundary,
      },
      () => new FakeAppServerProcess({ malformedEvent: true }),
    );
    await assert.rejects(
      adapter.execute(context(), {
        checkpoint: (checkpoint) => checkpoints.push(checkpoint),
        observeUsage: async () => undefined,
      }),
      /Malformed App Server JSONL event/,
    );
    assert.equal(
      checkpoints.some(
        (checkpoint) =>
          checkpoint.kind === "PROCESS_SHUTDOWN_REQUESTED" &&
          isObject(checkpoint.payload) &&
          checkpoint.payload.normalCompletion === false,
      ),
      true,
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("transport accepts the completed agent item when final turn items are empty", async () => {
  const fixture = createRepository();
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Return structured success",
        correlationId: "correlation-item-completed",
        workspace: fixture.boundary,
      },
      () => new FakeAppServerProcess({ completionItemOnly: true }),
    );
    const outcome = await adapter.execute(context(), hooks());
    assert.equal(outcome.kind, "SUCCEEDED");
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("transport observes launcher synchronous throw", async () => {
  const fixture = createRepository();
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Do not run",
        correlationId: "correlation-sync-throw",
        workspace: fixture.boundary,
      },
      () => {
        throw new Error("synthetic launcher throw");
      },
    );
    await assert.rejects(
      adapter.execute(context(), hooks()),
      /synthetic launcher throw/,
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("transport observes asynchronous process failure", async () => {
  const fixture = createRepository();
  try {
    let child: FakeAppServerProcess | undefined;
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Do not complete",
        correlationId: "correlation-async-failure",
        workspace: fixture.boundary,
      },
      () => {
        child = new FakeAppServerProcess({ suppressTerminal: true });
        return child;
      },
    );
    const execution = adapter.execute(context(), hooks());
    await new Promise<void>((resolve) => setImmediate(resolve));
    child?.emit("error", new Error("synthetic process failure"));
    await assert.rejects(execution, /synthetic process failure/);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("transport forwards interrupt at most once", async () => {
  const fixture = createRepository();
  const requests: string[] = [];
  let child: FakeAppServerProcess | undefined;
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Wait for interruption",
        correlationId: "correlation-interrupt",
        workspace: fixture.boundary,
      },
      () => {
        child = new FakeAppServerProcess({
          suppressTerminal: true,
          onRequest: (method) => requests.push(method),
        });
        return child;
      },
    );
    const execution = adapter.execute(context(), hooks());
    await new Promise<void>((resolve) => setImmediate(resolve));
    await adapter.interrupt();
    await adapter.interrupt();
    assert.equal(
      requests.filter((method) => method === "turn/interrupt").length,
      1,
    );
    child?.emit("exit", 1);
    await assert.rejects(execution, /exited before completion/);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

function engineRequest(
  runId: string,
  budget: RunExecutionRequest["budget"],
): RunExecutionRequest {
  return {
    projectId: "project-phase-3",
    taskId: "task-phase-3",
    runId,
    idempotencyKey: `idempotency:${runId}`,
    controllerId: "controller-N",
    leaseExpiresAt: "2026-07-30T09:30:00.000Z",
    now: () => timestamp,
    budget,
  };
}

test("timeout terminates an ignoring App Server before a late file mutation", async () => {
  const repository = createRepository();
  const ledgerDirectory = mkdtempSync(path.join(tmpdir(), "phase-3-timeout-"));
  const ledger = createLedger(ledgerDirectory);
  let child: FakeAppServerProcess | undefined;
  let lateWrite: NodeJS.Timeout | undefined;
  let lateWriteCancelled = false;
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Simulate a hanging Worker",
        correlationId: "correlation-timeout-shutdown",
        workspace: {
          ...repository.boundary,
          pathPolicy: { allowed: ["docs/late.md"], denied: [".git/**"] },
        },
        shutdownGraceMs: 5,
        forcedExitGraceMs: 10,
      },
      () => {
        child = new FakeAppServerProcess({
          suppressTerminal: true,
          ignoreStdinEnd: true,
          terminationBehavior: "exit",
          onTurn: () => {
            lateWrite = setTimeout(
              () =>
                writeFileSync(
                  path.join(repository.directory, "docs", "late.md"),
                  "late\n",
                ),
              5_000,
            );
          },
          onTerminate: () => {
            if (lateWrite !== undefined) {
              clearTimeout(lateWrite);
              lateWriteCancelled = true;
            }
          },
        });
        return child;
      },
    );
    const engine = new OrchestratorExecutionEngine(
      ledger,
      adapter,
      () => adapter.interrupt(),
    );
    const result = await engine.execute(
      engineRequest("run-timeout-shutdown", {
        tokenLimit: 10_000,
        wallTimeSeconds: 0.02,
        estimatedCostKrwLimit: 1_000,
      }),
    );
    assert.equal(result.run.state, "FAILED");
    assert.equal(ledger.taskState("task-phase-3"), "FAILED");
    assert.equal(
      ledger.runResult("run-timeout-shutdown")?.failureCode,
      "WALL_TIME_TIMEOUT",
    );
    assert.equal(child?.terminationCalls, 1);
    assert.equal(lateWriteCancelled, true);
    assert.equal(
      existsSync(path.join(repository.directory, "docs", "late.md")),
      false,
    );
    assert.equal(
      ledger
        .runCheckpoints("run-timeout-shutdown")
        .some((checkpoint) => checkpoint.kind === "PROCESS_EXITED"),
      true,
    );
  } finally {
    if (lateWrite !== undefined) {
      clearTimeout(lateWrite);
    }
    ledger.close();
    rmSync(ledgerDirectory, { recursive: true, force: true });
    rmSync(repository.directory, { recursive: true, force: true });
  }
});

test("budget breach terminates the App Server before a late file mutation", async () => {
  const repository = createRepository();
  const ledgerDirectory = mkdtempSync(path.join(tmpdir(), "phase-3-budget-"));
  const ledger = createLedger(ledgerDirectory);
  let child: FakeAppServerProcess | undefined;
  let lateWrite: NodeJS.Timeout | undefined;
  let lateWriteCancelled = false;
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Simulate a budget-breaching Worker",
        correlationId: "correlation-budget-shutdown",
        workspace: {
          ...repository.boundary,
          pathPolicy: {
            allowed: ["docs/budget-late.md"],
            denied: [".git/**"],
          },
        },
        shutdownGraceMs: 5,
        forcedExitGraceMs: 10,
      },
      () => {
        child = new FakeAppServerProcess({
          suppressTerminal: true,
          ignoreStdinEnd: true,
          terminationBehavior: "exit",
          usageInputTokens: 101,
          onTurn: () => {
            lateWrite = setTimeout(
              () =>
                writeFileSync(
                  path.join(repository.directory, "docs", "budget-late.md"),
                  "late\n",
                ),
              5_000,
            );
          },
          onTerminate: () => {
            if (lateWrite !== undefined) {
              clearTimeout(lateWrite);
              lateWriteCancelled = true;
            }
          },
        });
        return child;
      },
    );
    const engine = new OrchestratorExecutionEngine(
      ledger,
      adapter,
      () => adapter.interrupt(),
    );
    const result = await engine.execute(
      engineRequest("run-budget-shutdown", {
        tokenLimit: 100,
        wallTimeSeconds: 10,
        estimatedCostKrwLimit: 1_000,
      }),
    );
    assert.equal(result.run.state, "FAILED");
    assert.equal(
      ledger.runResult("run-budget-shutdown")?.failureCode,
      "TOKENS",
    );
    assert.equal(child?.terminationCalls, 1);
    assert.equal(lateWriteCancelled, true);
    assert.equal(
      existsSync(path.join(repository.directory, "docs", "budget-late.md")),
      false,
    );
  } finally {
    if (lateWrite !== undefined) {
      clearTimeout(lateWrite);
    }
    ledger.close();
    rmSync(ledgerDirectory, { recursive: true, force: true });
    rmSync(repository.directory, { recursive: true, force: true });
  }
});

for (const behavior of ["throw", "reject", "pending"] as const) {
  test(`termination ${behavior} cannot block timeout persistence`, async () => {
    const repository = createRepository();
    const ledgerDirectory = mkdtempSync(
      path.join(tmpdir(), `phase-3-terminate-${behavior}-`),
    );
    const ledger = createLedger(ledgerDirectory);
    let child: FakeAppServerProcess | undefined;
    try {
      const adapter = new AppServerWorkerAdapter(
        {
          goal: "Simulate a stuck App Server",
          correlationId: `correlation-terminate-${behavior}`,
          workspace: repository.boundary,
          shutdownGraceMs: 5,
          forcedExitGraceMs: 5,
        },
        () => {
          child = new FakeAppServerProcess({
            suppressTerminal: true,
            ignoreStdinEnd: true,
            terminationBehavior: behavior,
          });
          return child;
        },
      );
      assert.equal(adapter.interruptBoundaryMs, 1_000);
      const engine = new OrchestratorExecutionEngine(
        ledger,
        adapter,
        () => adapter.interrupt(),
      );
      const result = await engine.execute(
        engineRequest(`run-terminate-${behavior}`, {
          tokenLimit: 10_000,
          wallTimeSeconds: 0.02,
          estimatedCostKrwLimit: 1_000,
        }),
      );

      assert.equal(result.run.state, "FAILED");
      assert.equal(ledger.taskState("task-phase-3"), "FAILED");
      assert.equal(
        ledger.runResult(`run-terminate-${behavior}`)?.failureCode,
        "PROCESS_SHUTDOWN_FAILED",
      );
      assert.deepEqual(
        ledger.runResult(`run-terminate-${behavior}`)?.evidence,
        [
          "controller:process-shutdown-failed",
          "controller:original-failure:WALL_TIME_TIMEOUT",
        ],
      );
      assert.equal(
        ledger
          .runCheckpoints(`run-terminate-${behavior}`)
          .some((checkpoint) => checkpoint.kind === "PROCESS_EXIT_TIMEOUT"),
        true,
      );
      assert.equal(child?.terminationCalls, 1);
    } finally {
      ledger.close();
      rmSync(ledgerDirectory, { recursive: true, force: true });
      rmSync(repository.directory, { recursive: true, force: true });
    }
  });
}

test("unconfirmed shutdown supersedes a token budget breach", async () => {
  const repository = createRepository();
  const ledgerDirectory = mkdtempSync(
    path.join(tmpdir(), "phase-3-budget-shutdown-failure-"),
  );
  const ledger = createLedger(ledgerDirectory);
  let child: FakeAppServerProcess | undefined;
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Simulate an unconfirmed shutdown after budget breach",
        correlationId: "correlation-budget-shutdown-failure",
        workspace: repository.boundary,
        shutdownGraceMs: 5,
        forcedExitGraceMs: 5,
      },
      () => {
        child = new FakeAppServerProcess({
          suppressTerminal: true,
          ignoreStdinEnd: true,
          terminationBehavior: "pending",
          usageInputTokens: 101,
        });
        return child;
      },
    );
    const engine = new OrchestratorExecutionEngine(
      ledger,
      adapter,
      () => adapter.interrupt(),
    );
    const result = await engine.execute(
      engineRequest("run-budget-shutdown-failure", {
        tokenLimit: 100,
        wallTimeSeconds: 10,
        estimatedCostKrwLimit: 1_000,
      }),
    );
    const stored = ledger.runResult("run-budget-shutdown-failure");

    assert.equal(result.run.state, "FAILED");
    assert.equal(ledger.taskState("task-phase-3"), "FAILED");
    assert.equal(stored?.failureCode, "PROCESS_SHUTDOWN_FAILED");
    assert.deepEqual(stored?.evidence, [
      "controller:process-shutdown-failed",
      "controller:original-failure:TOKENS",
    ]);
    assert.equal(
      ledger
        .runCheckpoints("run-budget-shutdown-failure")
        .some((checkpoint) => checkpoint.kind === "PROCESS_EXIT_TIMEOUT"),
      true,
    );
    assert.equal(child?.terminationCalls, 1);
  } finally {
    ledger.close();
    rmSync(ledgerDirectory, { recursive: true, force: true });
    rmSync(repository.directory, { recursive: true, force: true });
  }
});

test("normal completion observes process exit without forced termination", async () => {
  const fixture = createRepository();
  const checkpoints: Array<{ kind: string; payload: unknown }> = [];
  let child: FakeAppServerProcess | undefined;
  try {
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Return structured success",
        correlationId: "correlation-normal-exit",
        workspace: fixture.boundary,
        shutdownGraceMs: 20,
        forcedExitGraceMs: 20,
      },
      () => {
        child = new FakeAppServerProcess({});
        return child;
      },
    );
    const outcome = await adapter.execute(context(), {
      checkpoint: (checkpoint) => checkpoints.push(checkpoint),
      observeUsage: async () => undefined,
    });

    assert.equal(outcome.kind, "SUCCEEDED");
    assert.equal(child?.terminationCalls, 0);
    assert.equal(
      checkpoints.some((checkpoint) => checkpoint.kind === "PROCESS_EXITED"),
      true,
    );
    assert.equal(
      checkpoints.some(
        (checkpoint) =>
          checkpoint.kind === "PROCESS_SHUTDOWN_REQUESTED" &&
          isObject(checkpoint.payload) &&
          checkpoint.payload.normalCompletion === true,
      ),
      true,
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("transport passes a minimal environment without credential variables", async () => {
  const fixture = createRepository();
  let capturedEnvironment: NodeJS.ProcessEnv | undefined;
  try {
    const launcher: AppServerLauncher = (_executable, _args, options) => {
      capturedEnvironment = options.env;
      return new FakeAppServerProcess({});
    };
    const adapter = new AppServerWorkerAdapter(
      {
        goal: "Return success without edits",
        correlationId: "correlation-env",
        workspace: fixture.boundary,
      },
      launcher,
    );
    await adapter.execute(context(), hooks());

    assert.equal(capturedEnvironment?.GITHUB_TOKEN, undefined);
    assert.equal(capturedEnvironment?.SUPABASE_SERVICE_ROLE_KEY, undefined);
    assert.equal(capturedEnvironment?.OPENAI_API_KEY, undefined);
    assert.equal(capturedEnvironment?.CODEX_ORCHESTRATED, "1");
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("workspace boundary blocks integration branches, foreign origins, and dirty starts", () => {
  const fixture = createRepository();
  try {
    assert.throws(
      () =>
        inspectExecutionWorkspace({
          ...fixture.boundary,
          branch: "main",
        }),
      /branch mismatch/,
    );
    assert.throws(
      () =>
        inspectExecutionWorkspace({
          ...fixture.boundary,
          canonicalOrigin: "https://example.invalid/foreign.git",
        }),
      /origin mismatch/,
    );
    writeFileSync(path.join(fixture.directory, "outside.txt"), "forbidden\n");
    assert.throws(
      () => inspectExecutionWorkspace(fixture.boundary),
      /not allowed/,
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("workspace ownership hash detects changes between retry attempts", () => {
  const fixture = createRepository();
  try {
    const first = inspectExecutionWorkspace(fixture.boundary);
    writeFileSync(path.join(fixture.directory, "docs", "fixture.md"), "changed\n");
    assert.throws(
      () => inspectExecutionWorkspace(fixture.boundary, first.statusHash),
      /outside the owned execution/,
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

function createLedger(directory: string): OrchestratorLedger {
  const ledger = new OrchestratorLedger(
    path.join(directory, "ledger.sqlite"),
    path.resolve(import.meta.dirname, ".."),
  );
  ledger.registerProject("project-phase-3", timestamp);
  ledger.registerRepository({
    repositoryId: "gonggamline-ai",
    canonicalOrigin,
    integrationBranch: "main",
    now: timestamp,
  });
  ledger.registerPc("N", "git,node,codex,sqlite", timestamp);
  ledger.createTask(
    {
      projectId: "project-phase-3",
      taskId: "task-phase-3",
      parentTaskId: null,
      idempotencyKey: "task:phase-3",
    },
    timestamp,
  );
  return ledger;
}

test("bounded loop carries verifier failure into a successful retry", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "phase-3-loop-"));
  const ledger = createLedger(directory);
  let verificationAttempt = 0;
  const seenContexts: WorkerExecutionContext[] = [];
  const worker = {
    name: "retry-context-worker",
    async execute(
      workerContext: WorkerExecutionContext,
    ): Promise<WorkerOutcome> {
      seenContexts.push(workerContext);
      return {
        kind: "SUCCEEDED",
        summary: "candidate change",
        output: {},
        evidence: [],
      };
    },
  };
  try {
    const results = await runDevelopmentLoop(
      ledger,
      worker,
      async () => undefined,
      {
        first: {
          projectId: "project-phase-3",
          taskId: "task-phase-3",
          runId: "run-phase-3-1",
          idempotencyKey: "run:phase-3:1",
          controllerId: "controller-N",
          leaseExpiresAt: "2026-07-30T09:30:00.000Z",
          now: () => timestamp,
          budget: {
            tokenLimit: 10_000,
            wallTimeSeconds: 300,
            estimatedCostKrwLimit: 1_000,
          },
          verificationPlan: {
            repositoryRoot: path.resolve(import.meta.dirname, ".."),
            requiredCommandIds: ["GIT_DIFF_CHECK"],
            retryableOnFailure: true,
          },
        },
        nextRunId: (attempt) => `run-phase-3-${attempt}`,
        nextIdempotencyKey: (attempt) => `run:phase-3:${attempt}`,
      },
      (_root, commandIds) => {
        verificationAttempt += 1;
        return commandIds.map((commandId) => ({
          commandId: commandId as VerificationCommandId,
          exitCode: verificationAttempt === 1 ? 1 : 0,
          durationMs: 1,
          outputHash: "a".repeat(64),
          passed: verificationAttempt > 1,
        }));
      },
    );

    assert.deepEqual(
      results.map((entry) => entry.run.state),
      ["RETRYABLE_FAILURE", "COMPLETED"],
    );
    assert.equal(seenContexts[1]?.priorFailure?.code, "VERIFICATION_FAILED");
    assert.equal(seenContexts[1]?.retryOfRunId, "run-phase-3-1");
  } finally {
    ledger.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("bounded loop ends in FAILED without throwing after retry exhaustion", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "phase-3-ceiling-"));
  const ledger = createLedger(directory);
  const worker = {
    name: "always-failing-worker",
    async execute(): Promise<WorkerOutcome> {
      return {
        kind: "FAILED",
        summary: "retryable fixture failure",
        errorCode: "FIXTURE_FAILURE",
        retryable: true,
        evidence: ["fixture:failure"],
      };
    },
  };
  try {
    const results = await runDevelopmentLoop(
      ledger,
      worker,
      async () => undefined,
      {
        first: {
          projectId: "project-phase-3",
          taskId: "task-phase-3",
          runId: "run-ceiling-1",
          idempotencyKey: "run:ceiling:1",
          controllerId: "controller-N",
          leaseExpiresAt: "2026-07-30T09:30:00.000Z",
          now: () => timestamp,
          budget: {
            tokenLimit: 10_000,
            wallTimeSeconds: 300,
            estimatedCostKrwLimit: 1_000,
          },
        },
        nextRunId: (attempt) => `run-ceiling-${attempt}`,
        nextIdempotencyKey: (attempt) => `run:ceiling:${attempt}`,
      },
    );

    assert.equal(results.length, 3);
    assert.equal(results.at(-1)?.run.state, "FAILED");
    assert.equal(ledger.taskState("task-phase-3"), "FAILED");
  } finally {
    ledger.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
