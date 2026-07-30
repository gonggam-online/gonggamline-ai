import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createDeliveryLifecycle } from "../tools/orchestrator/delivery.ts";
import {
  createVerifiedCommit,
  pushExactHead,
  reconcileDraftPullRequest,
  type DeliveryCommandRunner,
  type DeliveryIdentity,
} from "../tools/orchestrator/delivery-actions.ts";
import {
  observeExactHeadWorkflows,
  observeExactPreview,
  observePreviewBrowserEvidence,
} from "../tools/orchestrator/delivery-observer.ts";
import { runDeliveryPipeline } from "../tools/orchestrator/delivery-pipeline.ts";
import { runSupervisedOperator } from "../tools/orchestrator/operator.ts";
import type { WorkerOutcome } from "../tools/orchestrator/execution.ts";
import { OrchestratorLedger } from "../tools/orchestrator/ledger.ts";

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
    Array.from({ length: 6 }, () => ["NOT_STARTED", true]),
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

test("supervised operator routes approved implementation tasks to D", async () => {
  const setup = fixture();
  try {
    const task = JSON.parse(readFileSync(setup.contract, "utf8")) as Record<
      string,
      unknown
    >;
    task.taskKind = "IMPLEMENTATION";
    task.execution = {
      ...(task.execution as Record<string, unknown>),
      pcId: "D",
    };
    writeFileSync(setup.contract, JSON.stringify(task));

    const result = await runSupervisedOperator({
      taskContractPath: setup.contract,
      ledgerPath: setup.ledger,
      repositoryRoot: setup.root,
      now: () => timestamp,
      workerFactory: () => ({
        name: "fixture-worker",
        async execute(): Promise<WorkerOutcome> {
          return {
            kind: "SUCCEEDED",
            summary: "implemented",
            output: {},
            evidence: ["worker:completed"],
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
    });

    assert.equal(result.finalState, "COMPLETED");
  } finally {
    rmSync(path.dirname(setup.root), { recursive: true, force: true });
  }
});

test("supervised operator hands a completed run to idempotent delivery", async () => {
  const setup = fixture();
  let executions = 0;
  let pullRequestCreated = false;
  const writes: string[] = [];
  const headSha = "d".repeat(40);
  const runner: DeliveryCommandRunner = {
    run(executable, args) {
      const command = `${executable} ${args.join(" ")}`;
      if (executable === "git") {
        if (args[0] === "branch") {
          return { stdout: "codex/feat/phase-4", exitCode: 0 };
        }
        if (args[0] === "rev-parse") {
          return { stdout: headSha, exitCode: 0 };
        }
        if (args[0] === "merge-base") {
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "add") {
          writes.push("commit:add");
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "diff" && args.includes("--name-only")) {
          return { stdout: "allowed/change.txt", exitCode: 0 };
        }
        if (args[0] === "diff" || args[0] === "commit") {
          if (args[0] === "commit") {
            writes.push("commit:create");
          }
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "push") {
          writes.push("push");
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "ls-remote") {
          return {
            stdout: `${headSha}\trefs/heads/codex/feat/phase-4`,
            exitCode: 0,
          };
        }
      }
      if (command.startsWith("gh pr list")) {
        return {
          stdout: JSON.stringify(
            pullRequestCreated
              ? [
                  {
                    number: 77,
                    url: "https://github.com/example/repo/pull/77",
                    isDraft: true,
                    headRefName: "codex/feat/phase-4",
                    baseRefName: "main",
                  },
                ]
              : [],
          ),
          exitCode: 0,
        };
      }
      if (command.startsWith("gh pr create")) {
        pullRequestCreated = true;
        writes.push("pr:create");
        return {
          stdout: "https://github.com/example/repo/pull/77",
          exitCode: 0,
        };
      }
      if (command.startsWith("gh pr edit")) {
        return { stdout: "", exitCode: 0 };
      }
      if (command.startsWith("gh run list")) {
        return { stdout: "[]", exitCode: 0 };
      }
      return { stdout: "", exitCode: 1 };
    },
  };
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
            kind: "SUCCEEDED" as const,
            summary: "implemented",
            output: {},
            evidence: ["worker:completed"],
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
      delivery: {
        paths: ["allowed/change.txt"],
        commitMessage: "feat: deliver fixture",
        pullRequestTitle: "feat: deliver fixture",
        pullRequestBodyFile: "phase-4.md",
      },
      deliveryRunner: runner,
    };

    const first = await runSupervisedOperator(options);
    const second = await runSupervisedOperator(options);

    assert.equal(first.finalState, "WAITING_FOR_CI");
    assert.equal(second.finalState, "WAITING_FOR_CI");
    assert.equal(executions, 1);
    assert.equal(writes.filter((entry) => entry === "commit:create").length, 1);
    assert.equal(writes.filter((entry) => entry === "push").length, 1);
    assert.equal(writes.filter((entry) => entry === "pr:create").length, 1);
  } finally {
    rmSync(path.dirname(setup.root), { recursive: true, force: true });
  }
});

const exactHead = "a".repeat(40);
const deliveryIdentity: DeliveryIdentity = {
  repositoryRoot: "C:\\fixture",
  repositoryFullName: "example/repo",
  baseBranch: "main",
  baseSha: "b".repeat(40),
  branch: "codex/feat/phase-4",
  taskId: "phase-4-task",
};

function deliveryRunner(options?: {
  readonly existingPullRequests?: readonly unknown[];
  readonly draftUrl?: string;
}): {
  readonly runner: DeliveryCommandRunner;
  readonly calls: Array<{ executable: string; args: readonly string[] }>;
} {
  const calls: Array<{ executable: string; args: readonly string[] }> = [];
  return {
    calls,
    runner: {
      run(executable, args) {
        calls.push({ executable, args });
        if (executable === "git") {
          if (args[0] === "branch") {
            return { stdout: deliveryIdentity.branch, exitCode: 0 };
          }
          if (args[0] === "rev-parse") {
            return { stdout: exactHead, exitCode: 0 };
          }
          if (args[0] === "merge-base") {
            return { stdout: "", exitCode: 0 };
          }
          if (args[0] === "ls-remote") {
            return { stdout: `${exactHead}\trefs/heads/${deliveryIdentity.branch}`, exitCode: 0 };
          }
          if (args[0] === "push") {
            return { stdout: "", exitCode: 0 };
          }
        }
        if (executable === "gh" && args[0] === "pr" && args[1] === "list") {
          return {
            stdout: JSON.stringify(options?.existingPullRequests ?? []),
            exitCode: 0,
          };
        }
        if (executable === "gh" && args[0] === "pr" && args[1] === "create") {
          return {
            stdout: options?.draftUrl ?? "https://github.com/example/repo/pull/77",
            exitCode: 0,
          };
        }
        if (executable === "gh" && args[0] === "pr" && args[1] === "edit") {
          return { stdout: "", exitCode: 0 };
        }
        return { stdout: "", exitCode: 1 };
      },
    },
  };
}

test("exact-head push is idempotent and never uses force", () => {
  const ledger = new OrchestratorLedger(":memory:", process.cwd());
  const fixtureRunner = deliveryRunner();
  try {
    const first = pushExactHead(
      ledger,
      deliveryIdentity,
      "push:phase-4",
      fixtureRunner.runner,
    );
    const second = pushExactHead(
      ledger,
      deliveryIdentity,
      "push:phase-4",
      fixtureRunner.runner,
    );

    assert.equal(first.status, "CREATED");
    assert.equal(second.status, "RECONCILED");
    assert.equal(first.reference, exactHead);
    const push = fixtureRunner.calls.find(
      ({ executable, args }) => executable === "git" && args[0] === "push",
    );
    assert.ok(push);
    assert.equal(push.args.includes("--force"), false);
    assert.equal(
      fixtureRunner.calls.filter(
        ({ executable, args }) => executable === "git" && args[0] === "push",
      ).length,
      1,
    );
  } finally {
    ledger.close();
  }
});

test("verified commit stages only the declared path and reconciles by SHA", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "phase-4-commit-"));
  const ledger = new OrchestratorLedger(":memory:", directory);
  try {
    execFileSync("git", ["init", "-b", "main", directory]);
    execFileSync("git", ["-C", directory, "config", "user.email", "fixture@example.invalid"]);
    execFileSync("git", ["-C", directory, "config", "user.name", "Fixture"]);
    writeFileSync(path.join(directory, "approved.txt"), "before\n");
    execFileSync("git", ["-C", directory, "add", "approved.txt"]);
    execFileSync("git", ["-C", directory, "commit", "-m", "seed"]);
    const baseSha = git(directory, ["rev-parse", "HEAD"]);
    execFileSync("git", ["-C", directory, "switch", "-c", "codex/feat/commit"]);
    writeFileSync(path.join(directory, "approved.txt"), "after\n");
    const identity: DeliveryIdentity = {
      repositoryRoot: directory,
      repositoryFullName: "example/repo",
      baseBranch: "main",
      baseSha,
      branch: "codex/feat/commit",
      taskId: "commit-task",
    };

    const first = createVerifiedCommit(ledger, {
      identity,
      paths: ["approved.txt"],
      message: "test: approved commit",
      idempotencyKey: "commit:approved",
    });
    const second = createVerifiedCommit(ledger, {
      identity,
      paths: ["approved.txt"],
      message: "test: approved commit",
      idempotencyKey: "commit:approved",
    });

    assert.equal(first.status, "CREATED");
    assert.equal(second.status, "RECONCILED");
    assert.equal(first.reference, git(directory, ["rev-parse", "HEAD"]));
    assert.equal(git(directory, ["status", "--short"]), "");
  } finally {
    ledger.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Draft PR creation is duplicate-free and reconciles the required label", () => {
  const ledger = new OrchestratorLedger(":memory:", process.cwd());
  const fixtureRunner = deliveryRunner();
  try {
    const result = reconcileDraftPullRequest(
      ledger,
      {
        identity: deliveryIdentity,
        title: "feat: Phase 4",
        bodyFile: "phase-4-pr.md",
        requiredLabel: "manual-merge-required",
        idempotencyKey: "pr:phase-4",
      },
      fixtureRunner.runner,
    );

    assert.equal(result.status, "CREATED");
    assert.equal(result.reference, "https://github.com/example/repo/pull/77");
    assert.equal(
      fixtureRunner.calls.filter(
        ({ executable, args }) =>
          executable === "gh" && args[0] === "pr" && args[1] === "create",
      ).length,
      1,
    );
    assert.equal(
      fixtureRunner.calls.some(
        ({ executable, args }) =>
          executable === "gh" &&
          args[0] === "pr" &&
          args[1] === "edit" &&
          args.includes("manual-merge-required"),
      ),
      true,
    );
  } finally {
    ledger.close();
  }
});

test("Draft PR reconciliation fails closed when duplicates exist", () => {
  const ledger = new OrchestratorLedger(":memory:", process.cwd());
  const duplicate = {
    number: 1,
    url: "https://github.com/example/repo/pull/1",
    isDraft: true,
    headRefName: deliveryIdentity.branch,
    baseRefName: "main",
  };
  const fixtureRunner = deliveryRunner({
    existingPullRequests: [duplicate, { ...duplicate, number: 2 }],
  });
  try {
    assert.throws(
      () =>
        reconcileDraftPullRequest(
          ledger,
          {
            identity: deliveryIdentity,
            title: "feat: Phase 4",
            bodyFile: "phase-4-pr.md",
            requiredLabel: "manual-merge-required",
            idempotencyKey: "pr:duplicates",
          },
          fixtureRunner.runner,
        ),
      /Duplicate open pull requests/,
    );
  } finally {
    ledger.close();
  }
});

function observationRunner(
  responses: Readonly<Record<string, unknown>>,
): DeliveryCommandRunner {
  return {
    run(executable, args) {
      const key = `${executable} ${args.join(" ")}`;
      const response = responses[key];
      return response === undefined
        ? { stdout: "", exitCode: 1 }
        : { stdout: JSON.stringify(response), exitCode: 0 };
    },
  };
}

test("workflow observation accepts only required runs on the exact head", () => {
  const command = `gh run list --repo example/repo --commit ${exactHead} --event pull_request --json databaseId,headSha,status,conclusion,workflowName,url --limit 50`;
  const runner = observationRunner({
    [command]: [
      {
        databaseId: 10,
        headSha: exactHead,
        status: "completed",
        conclusion: "success",
        workflowName: "CI",
        url: "https://github.com/example/repo/actions/runs/10",
      },
      {
        databaseId: 9,
        headSha: "c".repeat(40),
        status: "completed",
        conclusion: "success",
        workflowName: "Preview browser validation",
        url: "https://github.com/example/repo/actions/runs/9",
      },
    ],
  });

  const evidence = observeExactHeadWorkflows({
    repositoryRoot: "C:\\fixture",
    repositoryFullName: "example/repo",
    headSha: exactHead,
    requiredWorkflowNames: ["CI", "Preview browser validation"],
    runner,
  });

  assert.deepEqual(evidence.map(({ status }) => status), [
    "SUCCEEDED",
    "WAITING",
  ]);
});

test("Preview observation rejects Production and resolves exact Preview", () => {
  const deployments =
    `gh api repos/example/repo/deployments?sha=${exactHead}&environment=Preview&per_page=10`;
  const statuses =
    "gh api repos/example/repo/deployments/88/statuses?per_page=5";
  const runner = observationRunner({
    [deployments]: [
      { id: 87, sha: exactHead, environment: "Production" },
      { id: 88, sha: exactHead, environment: "Preview" },
    ],
    [statuses]: [
      {
        state: "success",
        environment_url: "https://preview.example.invalid",
      },
    ],
  });

  const evidence = observeExactPreview({
    repositoryRoot: "C:\\fixture",
    repositoryFullName: "example/repo",
    headSha: exactHead,
    runner,
  });

  assert.equal(evidence.status, "SUCCEEDED");
  assert.equal(evidence.deploymentId, 88);
  assert.equal(evidence.environment, "Preview");
});

test("browser evidence requires a non-expired artifact from the exact workflow", () => {
  const artifacts =
    "gh api repos/example/repo/actions/runs/99/artifacts";
  const runner = observationRunner({
    [artifacts]: {
      artifacts: [
        {
          id: 123,
          name: "preview-browser-evidence",
          expired: false,
          size_in_bytes: 456,
          archive_download_url:
            "https://api.github.com/repos/example/repo/actions/artifacts/123/zip",
        },
      ],
    },
  });

  const evidence = observePreviewBrowserEvidence({
    repositoryRoot: "C:\\fixture",
    repositoryFullName: "example/repo",
    headSha: exactHead,
    workflow: {
      name: "Preview browser validation",
      runId: 99,
      status: "SUCCEEDED",
      url: "https://github.com/example/repo/actions/runs/99",
      headSha: exactHead,
    },
    runner,
  });

  assert.equal(evidence.status, "SUCCEEDED");
  assert.equal(evidence.artifactId, 123);
  assert.match(evidence.artifactDigest ?? "", /^[a-f0-9]{64}$/);
});

test("delivery pipeline restarts without duplicate writes and stops for human", () => {
  const ledger = new OrchestratorLedger(":memory:", process.cwd());
  let pullRequestCreated = false;
  const writes: string[] = [];
  const runner: DeliveryCommandRunner = {
    run(executable, args) {
      const command = `${executable} ${args.join(" ")}`;
      if (executable === "git") {
        if (args[0] === "branch") {
          return { stdout: deliveryIdentity.branch, exitCode: 0 };
        }
        if (args[0] === "rev-parse") {
          return { stdout: exactHead, exitCode: 0 };
        }
        if (args[0] === "merge-base") {
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "add") {
          writes.push("commit:add");
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "diff" && args.includes("--name-only")) {
          return { stdout: "approved.txt", exitCode: 0 };
        }
        if (args[0] === "diff") {
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "commit") {
          writes.push("commit:create");
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "push") {
          writes.push("push");
          return { stdout: "", exitCode: 0 };
        }
        if (args[0] === "ls-remote") {
          return {
            stdout: `${exactHead}\trefs/heads/${deliveryIdentity.branch}`,
            exitCode: 0,
          };
        }
      }
      if (command.startsWith("gh pr list")) {
        return {
          stdout: JSON.stringify(
            pullRequestCreated
              ? [
                  {
                    number: 77,
                    url: "https://github.com/example/repo/pull/77",
                    isDraft: true,
                    headRefName: deliveryIdentity.branch,
                    baseRefName: "main",
                  },
                ]
              : [],
          ),
          exitCode: 0,
        };
      }
      if (command.startsWith("gh pr create")) {
        pullRequestCreated = true;
        writes.push("pr:create");
        return {
          stdout: "https://github.com/example/repo/pull/77",
          exitCode: 0,
        };
      }
      if (command.startsWith("gh pr edit")) {
        return { stdout: "", exitCode: 0 };
      }
      if (command.startsWith("gh run list")) {
        return {
          stdout: JSON.stringify(
            ["CI", "Preview browser validation"].map((workflowName, index) => ({
              databaseId: 100 + index,
              headSha: exactHead,
              status: "completed",
              conclusion: "success",
              workflowName,
              url: `https://github.com/example/repo/actions/runs/${100 + index}`,
            })),
          ),
          exitCode: 0,
        };
      }
      if (command.includes("/deployments?")) {
        return {
          stdout: JSON.stringify([
            { id: 88, sha: exactHead, environment: "Preview" },
          ]),
          exitCode: 0,
        };
      }
      if (command.includes("/deployments/88/statuses")) {
        return {
          stdout: JSON.stringify([
            {
              state: "success",
              environment_url: "https://preview.example.invalid",
            },
          ]),
          exitCode: 0,
        };
      }
      if (command.includes("/actions/runs/101/artifacts")) {
        return {
          stdout: JSON.stringify({
            artifacts: [
              {
                id: 123,
                name: "preview-browser-evidence",
                expired: false,
                size_in_bytes: 456,
                archive_download_url:
                  "https://api.github.com/repos/example/repo/actions/artifacts/123/zip",
              },
            ],
          }),
          exitCode: 0,
        };
      }
      return { stdout: "", exitCode: 1 };
    },
  };
  const request = {
    commit: {
      identity: deliveryIdentity,
      paths: ["approved.txt"],
      message: "feat: phase 4 fixture",
      idempotencyKey: "pipeline:commit",
    },
    pushIdempotencyKey: "pipeline:push",
    pullRequest: {
      title: "feat: phase 4 fixture",
      bodyFile: "phase-4.md",
      requiredLabel: "manual-merge-required",
      idempotencyKey: "pipeline:pr",
    },
    requiredWorkflowNames: [
      "CI",
      "Preview browser validation",
    ] as const,
  };
  try {
    const first = runDeliveryPipeline(ledger, request, runner);
    const second = runDeliveryPipeline(ledger, request, runner);

    assert.equal(first.state, "WAITING_FOR_HUMAN");
    assert.equal(second.state, "WAITING_FOR_HUMAN");
    assert.equal(writes.filter((entry) => entry === "commit:create").length, 1);
    assert.equal(writes.filter((entry) => entry === "push").length, 1);
    assert.equal(writes.filter((entry) => entry === "pr:create").length, 1);
    assert.equal(ledger.verifyAuditChain(), true);
  } finally {
    ledger.close();
  }
});
