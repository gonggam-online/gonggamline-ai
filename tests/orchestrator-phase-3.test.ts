import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
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
import type {
  WorkerExecutionContext,
  WorkerHooks,
  WorkerOutcome,
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
}

class FakeAppServerProcess extends EventEmitter implements AppServerProcess {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin: Writable;

  constructor(options: FakeServerOptions) {
    super();
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
                items: [{ type: "agentMessage", text: finalText }],
              },
            },
          });
          if (!options.suppressTerminal) {
            setImmediate(() => {
              this.stdout.write(`${terminal}\n`);
              if (options.duplicateTerminal) {
                this.stdout.write(`${terminal}\n`);
              }
            });
          }
        }
        callback();
      },
    });
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

test("transport rejects malformed JSONL without accepting success", async () => {
  const fixture = createRepository();
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
      adapter.execute(context(), hooks()),
      /Malformed App Server JSONL event/,
    );
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
