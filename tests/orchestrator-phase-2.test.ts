import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  OrchestratorExecutionEngine,
  type WorkerAdapter,
  type WorkerOutcome,
} from "../tools/orchestrator/execution.ts";
import { FakeWorkerAdapter } from "../tools/orchestrator/fake-worker.ts";
import { OrchestratorLedger } from "../tools/orchestrator/ledger.ts";
import {
  runLocalVerification,
  verifyChangedPaths,
} from "../tools/orchestrator/verifier.ts";
import { inspectWorktree } from "../tools/orchestrator/worktree-guard.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const timestamp = "2026-07-29T09:00:00.000Z";

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
    );
    const result = await engine.execute(request("run-001", "run:001"));

    assert.equal(result.run.state, "COMPLETED");
    assert.equal(result.run.attempt, 1);
    assert.equal(result.outcome?.kind, "SUCCEEDED");
    assert.equal(fixture.ledger.runResult("run-001")?.outcome, "SUCCEEDED");
    assert.equal(
      fixture.ledger.runResult("run-001")?.evidence.includes("verify:passed"),
      true,
    );
    assert.equal(fixture.ledger.latestRunCheckpoint("run-001")?.kind, "FILE_WRITTEN");
    assert.equal(fixture.ledger.verifyAuditChain(), true);
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

test("local verifier stores hashes and rejects external-capable commands", () => {
  const evidence = runLocalVerification(repositoryRoot, [
    {
      name: "node-smoke",
      executable: process.execPath,
      args: ["-e", "process.stdout.write('safe fixture')"],
      timeoutMs: 10_000,
    },
  ]);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.passed, true);
  assert.match(evidence[0]?.outputHash ?? "", /^[a-f0-9]{64}$/);
  assert.throws(
    () =>
      runLocalVerification(repositoryRoot, [
        {
          name: "forbidden-network",
          executable: "curl.exe",
          args: ["https://example.invalid"],
          timeoutMs: 10_000,
        },
      ]),
    /forbidden/,
  );
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
          {
            name: "git-diff-check",
            executable: "git",
            args: ["diff", "--check"],
            timeoutMs: 10_000,
          },
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
