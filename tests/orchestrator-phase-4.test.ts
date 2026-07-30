import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createDeliveryLifecycle } from "../tools/orchestrator/delivery.ts";
import { runSupervisedOperator } from "../tools/orchestrator/operator.ts";
import type { WorkerOutcome } from "../tools/orchestrator/execution.ts";

const timestamp = "2026-07-30T00:00:00.000Z";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function fixture(): {
  readonly root: string;
  readonly ledger: string;
  readonly contract: string;
} {
  const directory = mkdtempSync(path.join(tmpdir(), "phase-4-operator-"));
  const root = path.join(directory, "repo");
  mkdirSync(path.join(root, "docs", "orchestrator"), { recursive: true });
  execFileSync("git", ["init", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.invalid"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", root, "remote", "add", "origin", "https://github.com/example/repo.git"]);
  writeFileSync(path.join(root, "seed.txt"), "seed\n");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-m", "seed"]);
  execFileSync("git", ["-C", root, "switch", "-c", "codex/feat/phase-4"]);
  const baseSha = git(root, ["rev-parse", "HEAD"]);
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  for (const name of ["task-contract.schema.json", "result-contract.schema.json"]) {
    writeFileSync(
      path.join(root, "docs", "orchestrator", name),
      readFileSync(path.join(repositoryRoot, "docs", "orchestrator", name)),
    );
  }
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-m", "schemas"]);
  const schemaSha = git(root, ["rev-parse", "HEAD"]);
  const contract = path.join(directory, "task.json");
  const task = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, "docs", "orchestrator", "examples", "phase-0-protocol-spike.task.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  Object.assign(task, {
    projectId: "phase-4-project",
    taskId: "phase-4-task",
    objective: "Run a hermetic supervised operator",
    repository: {
      canonicalOrigin: "https://github.com/example/repo.git",
      baseBranch: "main",
      baseSha: schemaSha,
      workBranch: "codex/feat/phase-4",
      dependencyPrNumbers: [],
    },
    execution: {
      pcId: "N",
      worktreePath: root,
      controllerId: "phase-4-controller",
      codexThreadId: null,
      reviewResponseId: null,
      idempotencyKey: `sha256:${"a".repeat(64)}`,
      sandbox: "workspace-write",
    },
    scope: {
      summary: ["Hermetic operator test"],
      nonGoals: ["No external writes"],
      allowedPaths: ["allowed/**"],
      forbiddenPaths: [".git/**"],
    },
    verification: {
      commands: [{ name: "git-safety", command: "git diff --check", timeoutSeconds: 60 }],
      requiredEvidence: ["fixed verifier"],
      browserRequired: false,
      exactPreviewRequired: false,
    },
  });
  writeFileSync(contract, JSON.stringify(task));
  assert.notEqual(baseSha, schemaSha);
  return { root, ledger: path.join(directory, "ledger.sqlite"), contract };
}

test("delivery lifecycle is typed and leaves external stages inert", () => {
  const lifecycle = createDeliveryLifecycle("task-1");
  assert.equal(lifecycle.stages[0]?.status, "READY");
  assert.deepEqual(
    lifecycle.stages.slice(1).map(({ status, externalWrite }) => [status, externalWrite]),
    Array.from({ length: 5 }, () => ["NOT_STARTED", true]),
  );
});

test("supervised operator validates, registers idempotently, and returns sanitized summary", async () => {
  const setup = fixture();
  let executions = 0;
  try {
    const options = {
      taskContractPath: setup.contract,
      ledgerPath: setup.ledger,
      repositoryRoot: setup.root,
      now: () => timestamp,
      workerFactory: () => ({
        name: "fixture-worker",
        async execute(): Promise<WorkerOutcome> {
          executions += 1;
          return {
            kind: "SUCCEEDED",
            summary: "token=super-secret",
            output: {},
            evidence: ["api_key=super-secret"],
          };
        },
      }),
      verifier: (_root: string, commandIds: readonly string[]) =>
        commandIds.map((commandId) => ({
          commandId: commandId as "GIT_DIFF_CHECK",
          exitCode: 0,
          durationMs: 1,
          outputHash: "b".repeat(64),
          passed: true,
        })),
    };
    const first = await runSupervisedOperator(options);
    const second = await runSupervisedOperator(options);
    assert.equal(first.finalState, "COMPLETED");
    assert.equal(second.finalState, "COMPLETED");
    assert.equal(executions, 1);
    assert.doesNotMatch(JSON.stringify(first), /super-secret/);
  } finally {
    rmSync(path.dirname(setup.root), { recursive: true, force: true });
  }
});

test("supervised operator rejects a mismatched approved base before execution", async () => {
  const setup = fixture();
  try {
    const task = JSON.parse(readFileSync(setup.contract, "utf8")) as {
      repository: { baseSha: string };
    };
    task.repository.baseSha = "0".repeat(40);
    writeFileSync(setup.contract, JSON.stringify(task));
    await assert.rejects(
      runSupervisedOperator({
        taskContractPath: setup.contract,
        ledgerPath: setup.ledger,
        repositoryRoot: setup.root,
        workerFactory: () => ({
          name: "must-not-run",
          async execute(): Promise<WorkerOutcome> {
            throw new Error("unexpected execution");
          },
        }),
      }),
      /approved base SHA/,
    );
  } finally {
    rmSync(path.dirname(setup.root), { recursive: true, force: true });
  }
});
