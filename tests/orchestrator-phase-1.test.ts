import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  BudgetExceededError,
  BudgetGuard,
  type UsageSnapshot,
} from "../tools/orchestrator/budget.ts";
import {
  ContractValidationError,
  createContractValidators,
} from "../tools/orchestrator/contracts.ts";
import {
  assertLedgerOutsideRepository,
  OrchestratorLedger,
} from "../tools/orchestrator/ledger.ts";
import { evaluatePath, requiresManualApproval } from "../tools/orchestrator/policy.ts";
import {
  interruptThenPlanRecovery,
  planWindowsProcessRecovery,
} from "../tools/orchestrator/recovery.ts";
import { defaultPcRoutes, selectPc } from "../tools/orchestrator/router.ts";
import { canTransition } from "../tools/orchestrator/state-machine.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const now = "2026-07-28T12:00:00.000Z";

function readJson(relativePath: string): object {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8")) as object;
}

function createLedgerFixture(): {
  ledger: OrchestratorLedger;
  databasePath: string;
  directory: string;
} {
  const directory = mkdtempSync(path.join(tmpdir(), "gonggamline-orchestrator-"));
  const databasePath = path.join(directory, "ledger.sqlite");
  const ledger = new OrchestratorLedger(databasePath, repositoryRoot);
  ledger.registerProject("project-001", now);
  ledger.registerRepository({
    repositoryId: "gonggamline-ai",
    canonicalOrigin: "https://github.com/gonggam-online/gonggamline-ai.git",
    integrationBranch: "main",
    now,
  });
  ledger.registerPc("N", "git,node,codex", now);
  ledger.registerPc("D", "git,node,codex", now);
  return { ledger, databasePath, directory };
}

function createTask(ledger: OrchestratorLedger, taskId: string): void {
  assert.equal(
    ledger.createTask(
      {
        projectId: "project-001",
        taskId,
        parentTaskId: null,
        idempotencyKey: `task:${taskId}`,
      },
      now,
    ),
    "CREATED",
  );
}

test("canonical Task and Result contracts validate the Phase 0 fixtures", () => {
  const validators = createContractValidators(
    readJson("docs/orchestrator/task-contract.schema.json"),
    readJson("docs/orchestrator/result-contract.schema.json"),
  );
  validators.validateTask(
    readJson("docs/orchestrator/examples/phase-0-protocol-spike.task.json"),
  );
  validators.validateResult(
    readJson("docs/orchestrator/examples/phase-0-read-only.result.json"),
  );
});

test("canonical post-validation rejects model output that only resembles a result", () => {
  const validators = createContractValidators(
    readJson("docs/orchestrator/task-contract.schema.json"),
    readJson("docs/orchestrator/result-contract.schema.json"),
  );
  assert.throws(
    () =>
      validators.validateResult({
        schemaVersion: "1.0.0",
        state: "COMPLETED",
        summary: "model prose cannot satisfy the canonical contract",
      }),
    ContractValidationError,
  );
});

test("state machine prohibits skipped success and permits declared recovery", () => {
  assert.equal(canTransition("PLANNED", "COMPLETED"), false);
  assert.equal(canTransition("RUNNING", "RETRYABLE_FAILURE"), true);
  assert.equal(canTransition("WAITING_FOR_CI", "VERIFYING"), true);
  assert.equal(canTransition("COMPLETED", "READY"), false);
});

test("ledger path must be absolute and outside the Git repository", () => {
  assert.throws(
    () =>
      assertLedgerOutsideRepository(
        path.join(repositoryRoot, ".orchestrator", "ledger.sqlite"),
        repositoryRoot,
      ),
    /outside the Git repository/,
  );
  assert.throws(
    () => assertLedgerOutsideRepository("ledger.sqlite", repositoryRoot),
    /absolute/,
  );
});

test("D/N controllers cannot duplicate task, branch, worktree, PR, or action after restart", () => {
  const fixture = createLedgerFixture();
  try {
    createTask(fixture.ledger, "task-n-001");
    assert.equal(
      fixture.ledger.createTask(
        {
          projectId: "project-001",
          taskId: "task-n-001",
          parentTaskId: null,
          idempotencyKey: "task:task-n-001",
        },
        now,
      ),
      "EXISTS",
    );
    assert.throws(
      () =>
        fixture.ledger.createTask(
          {
            projectId: "project-001",
            taskId: "task-n-conflict",
            parentTaskId: null,
            idempotencyKey: "task:task-n-001",
          },
          now,
        ),
      /collision/,
    );
    fixture.ledger.assignRoute(
      {
        taskId: "task-n-001",
        repositoryId: "gonggamline-ai",
        pcId: "N",
        branch: "codex/feat/task-n-001",
        worktreePath: "C:\\worktrees\\task-n-001",
      },
      now,
    );
    assert.equal(
      fixture.ledger.reserveAction({
        actionScope: "GITHUB_DRAFT_PR",
        idempotencyKey: "pr:task-n-001",
        payload: { base: "main", head: "codex/feat/task-n-001" },
        now,
      }),
      "RESERVED",
    );
    fixture.ledger.close();

    const restarted = new OrchestratorLedger(fixture.databasePath, repositoryRoot);
    try {
      restarted.registerProject("project-001", now);
      createTask(restarted, "task-d-002");
      assert.throws(
        () =>
          restarted.assignRoute(
            {
              taskId: "task-d-002",
              repositoryId: "gonggamline-ai",
              pcId: "D",
              branch: "codex/feat/task-n-001",
              worktreePath: "C:\\worktrees\\task-d-002",
            },
            now,
          ),
        /UNIQUE constraint failed/,
      );
      assert.equal(
        restarted.reserveAction({
          actionScope: "GITHUB_DRAFT_PR",
          idempotencyKey: "pr:task-n-001",
          payload: { head: "codex/feat/task-n-001", base: "main" },
          now,
        }),
        "EXISTS",
      );
      assert.throws(
        () =>
          restarted.reserveAction({
            actionScope: "GITHUB_DRAFT_PR",
            idempotencyKey: "pr:task-n-001",
            payload: { head: "different-head", base: "main" },
            now,
          }),
        /payload mismatch/,
      );
      assert.equal(restarted.verifyAuditChain(), true);
    } finally {
      restarted.close();
    }
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("lease acquisition is exclusive and expired RUNNING tasks become recovery candidates", () => {
  const fixture = createLedgerFixture();
  let secondController: OrchestratorLedger | null = null;
  try {
    createTask(fixture.ledger, "task-lease-001");
    fixture.ledger.transition("task-lease-001", "READY", now);
    fixture.ledger.transition("task-lease-001", "RUNNING", now);
    secondController = new OrchestratorLedger(fixture.databasePath, repositoryRoot);
    assert.equal(
      secondController.acquireLease(
        {
          taskId: "task-lease-001",
          controllerId: "controller-N",
          expiresAt: "2026-07-28T12:05:00.000Z",
        },
        now,
      ),
      true,
    );
    assert.equal(
      fixture.ledger.acquireLease(
        {
          taskId: "task-lease-001",
          controllerId: "controller-D",
          expiresAt: "2026-07-28T12:05:00.000Z",
        },
        "2026-07-28T12:01:00.000Z",
      ),
      false,
    );
    assert.deepEqual(
      fixture.ledger.expiredRunningTasks("2026-07-28T12:06:00.000Z"),
      ["task-lease-001"],
    );
    assert.equal(fixture.ledger.taskState("task-lease-001"), "RUNNING");
  } finally {
    secondController?.close();
    fixture.ledger.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("audit hash chain detects tampering", () => {
  const fixture = createLedgerFixture();
  let verifier: OrchestratorLedger | null = null;
  try {
    createTask(fixture.ledger, "task-audit-001");
    assert.equal(fixture.ledger.verifyAuditChain(), true);
    fixture.ledger.close();
    const tamperConnection = new DatabaseSync(fixture.databasePath);
    tamperConnection
      .prepare("UPDATE audit_events SET payload_json = ? WHERE sequence = 1")
      .run('{"tampered":true}');
    tamperConnection.close();
    verifier = new OrchestratorLedger(fixture.databasePath, repositoryRoot);
    assert.equal(verifier.verifyAuditChain(), false);
  } finally {
    verifier?.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("token budget breach requests App Server interruption once and fails closed", async () => {
  let interrupts = 0;
  const guard = new BudgetGuard(
    { tokenLimit: 100, wallTimeSeconds: 60, estimatedCostKrwLimit: 10 },
    async () => {
      interrupts += 1;
    },
  );
  const usage: UsageSnapshot = {
    inputTokens: 90,
    outputTokens: 11,
    reasoningTokens: 0,
    estimatedCostKrw: 0,
    elapsedSeconds: 10,
  };
  await assert.rejects(() => guard.observe(usage), BudgetExceededError);
  await assert.rejects(() => guard.observe(usage), BudgetExceededError);
  assert.equal(interrupts, 1);
});

test("wall-time and cost budget breaches use the same fail-closed interrupt path", async () => {
  for (const usage of [
    {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      estimatedCostKrw: 0,
      elapsedSeconds: 61,
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      estimatedCostKrw: 11,
      elapsedSeconds: 1,
    },
  ]) {
    let interrupts = 0;
    const guard = new BudgetGuard(
      { tokenLimit: 100, wallTimeSeconds: 60, estimatedCostKrwLimit: 10 },
      async () => {
        interrupts += 1;
      },
    );
    await assert.rejects(() => guard.observe(usage), BudgetExceededError);
    assert.equal(interrupts, 1);
  }
});

test("App Server acknowledgement prevents process kill fallback", async () => {
  const plan = await interruptThenPlanRecovery({
    taskId: "task-recovery-001",
    threadId: "thread-001",
    turnId: "turn-001",
    rootPid: 100,
    processes: [
      { pid: 100, parentPid: null, executable: "codex.exe", taskId: "task-recovery-001" },
    ],
    appServer: {
      async interruptTurn(threadId, turnId) {
        assert.equal(threadId, "thread-001");
        assert.equal(turnId, "turn-001");
        return "acknowledged";
      },
    },
  });
  assert.deepEqual(plan, {
    safeToStop: [],
    refused: [],
    reason: "APP_SERVER_ACKNOWLEDGED",
  });
});

test("Windows recovery refuses the entire tree when any descendant is ambiguous", () => {
  const plan = planWindowsProcessRecovery(
    "task-recovery-001",
    100,
    [
      { pid: 100, parentPid: null, executable: "codex.cmd", taskId: "task-recovery-001" },
      { pid: 101, parentPid: 100, executable: "node.exe", taskId: "task-recovery-001" },
      { pid: 102, parentPid: 101, executable: "codex.exe", taskId: "task-recovery-001" },
      { pid: 103, parentPid: 101, executable: "powershell.exe", taskId: null },
    ],
    false,
  );
  assert.deepEqual(plan.safeToStop, []);
  assert.deepEqual(plan.refused, [103]);
  assert.equal(plan.reason, "MANUAL_RECONCILIATION");
});

test("Windows recovery returns an owned process tree in child-first order", () => {
  const plan = planWindowsProcessRecovery(
    "task-recovery-001",
    500,
    [
      { pid: 500, parentPid: null, executable: "codex.cmd", taskId: "task-recovery-001" },
      { pid: 100, parentPid: 500, executable: "node.exe", taskId: "task-recovery-001" },
      { pid: 400, parentPid: 100, executable: "codex.exe", taskId: "task-recovery-001" },
    ],
    false,
  );
  assert.deepEqual(plan.safeToStop, [400, 100, 500]);
  assert.deepEqual(plan.refused, []);
  assert.equal(plan.reason, "OWNED_PROCESS_TREE");
});

test("path and approval policies fail closed", () => {
  const policy = {
    allowed: ["docs/orchestrator/**", "tools/orchestrator/**"],
    denied: ["docs/orchestrator/secrets/**"],
  };
  assert.equal(evaluatePath(policy, "tools/orchestrator/ledger.ts").allowed, true);
  assert.equal(evaluatePath(policy, "app/api/write/route.ts").allowed, false);
  assert.equal(evaluatePath(policy, "../outside.txt").reason, "INVALID_PATH");
  assert.equal(
    evaluatePath(policy, "docs/orchestrator/secrets/value.txt").reason,
    "DENIED",
  );
  assert.equal(requiresManualApproval("FINAL_PR_MERGE"), true);
  assert.equal(requiresManualApproval("READ_REPOSITORY"), false);
});

test("routing table assigns N and D only for explicit task classes and capabilities", () => {
  assert.equal(
    selectPc(defaultPcRoutes, {
      taskClass: "ORCHESTRATOR",
      requiredCapabilities: ["sqlite"],
      availableCapabilitiesByPc: {
        N: ["git", "node", "codex", "sqlite"],
        D: ["git", "node", "codex"],
      },
    }),
    "N",
  );
  assert.throws(
    () =>
      selectPc(defaultPcRoutes, {
        taskClass: "UNKNOWN",
        requiredCapabilities: [],
        availableCapabilitiesByPc: { N: ["git", "node", "codex"] },
      }),
    /No deterministic PC route/,
  );
});
