import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { AppServerWorkerAdapter } from "./app-server-worker.ts";
import { createContractValidators } from "./contracts.ts";
import { runDevelopmentLoop } from "./development-loop.ts";
import { createDeliveryLifecycle, type DeliveryLifecycle } from "./delivery.ts";
import type {
  RunExecutionResult,
  RunVerifier,
  WorkerAdapter,
} from "./execution.ts";
import { OrchestratorLedger } from "./ledger.ts";
import { sanitizeOrchestratorValue } from "./redaction.ts";
import { defaultPcRoutes, selectPc } from "./router.ts";
import type { VerificationCommandId } from "./verifier.ts";
import {
  inspectExecutionWorkspace,
  type WorkspaceBoundary,
} from "./workspace-boundary.ts";

interface TaskContract {
  readonly projectId: string;
  readonly taskId: string;
  readonly parentTaskId?: string | null;
  readonly objective: string;
  readonly repository: {
    readonly canonicalOrigin: string;
    readonly baseBranch: string;
    readonly baseSha: string;
    readonly workBranch: string;
  };
  readonly execution: {
    readonly pcId: string;
    readonly worktreePath: string;
    readonly controllerId: string;
    readonly idempotencyKey: string;
  };
  readonly scope: {
    readonly allowedPaths: readonly string[];
    readonly forbiddenPaths: readonly string[];
  };
  readonly verification: {
    readonly commands: readonly { readonly name: string }[];
  };
  readonly budgets: {
    readonly wallTimeMinutes: number;
    readonly tokenLimit: number;
    readonly costKrwLimit: number;
  };
}

export interface OperatorSummary {
  readonly taskId: string;
  readonly finalState: string;
  readonly attempts: number;
  readonly lifecycle: DeliveryLifecycle;
  readonly evidence: readonly string[];
}

export interface SupervisedOperatorOptions {
  readonly taskContractPath: string;
  readonly ledgerPath: string;
  readonly repositoryRoot?: string;
  readonly taskSchemaPath?: string;
  readonly resultSchemaPath?: string;
  readonly runId?: string;
  readonly now?: () => string;
  readonly workerFactory?: (boundary: WorkspaceBoundary, goal: string) => WorkerAdapter;
  readonly verifier?: RunVerifier;
}

const commandNames: Readonly<Record<string, VerificationCommandId>> = {
  "git-safety": "GIT_DIFF_CHECK",
  "git-diff-check": "GIT_DIFF_CHECK",
  lint: "LINT",
  typecheck: "TYPECHECK",
  test: "TEST",
  build: "BUILD",
};

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function verificationIds(contract: TaskContract): VerificationCommandId[] {
  const ids = contract.verification.commands.map(({ name }) => commandNames[name]);
  if (ids.some((entry) => entry === undefined)) {
    throw new Error("TaskContract contains a verification command not approved by the fixed verifier");
  }
  return [...new Set(ids)];
}

function repositoryId(origin: string): string {
  const match = /\/([^/]+?)(?:\.git)?$/.exec(origin);
  if (match?.[1] === undefined) {
    throw new Error("Canonical repository origin has no repository name");
  }
  return match[1];
}

function finalEvidence(result: RunExecutionResult): readonly string[] {
  const outcome = result.outcome;
  if (outcome === null) {
    return ["operator:idempotent-existing-run"];
  }
  return outcome.evidence;
}

export async function runSupervisedOperator(
  options: SupervisedOperatorOptions,
): Promise<OperatorSummary> {
  const repositoryRoot = realpathSync.native(
    path.resolve(options.repositoryRoot ?? process.cwd()),
  );
  const contractPath = path.resolve(options.taskContractPath);
  const taskSchemaPath = path.resolve(
    options.taskSchemaPath ??
      path.join(repositoryRoot, "docs/orchestrator/task-contract.schema.json"),
  );
  const resultSchemaPath = path.resolve(
    options.resultSchemaPath ??
      path.join(repositoryRoot, "docs/orchestrator/result-contract.schema.json"),
  );
  const value = readJson(contractPath);
  const validators = createContractValidators(
    readJson(taskSchemaPath) as object,
    readJson(resultSchemaPath) as object,
  );
  validators.validateTask(value);
  const contract = value as TaskContract;
  const worktreeRoot = realpathSync.native(path.resolve(contract.execution.worktreePath));
  if (worktreeRoot.toLowerCase() !== repositoryRoot.toLowerCase()) {
    throw new Error("TaskContract worktree does not match the supervised repository");
  }
  const boundary: WorkspaceBoundary = {
    repositoryRoot,
    canonicalOrigin: contract.repository.canonicalOrigin,
    branch: contract.repository.workBranch,
    baseSha: contract.repository.baseSha,
    pathPolicy: {
      allowed: contract.scope.allowedPaths,
      denied: contract.scope.forbiddenPaths,
    },
  };
  inspectExecutionWorkspace(boundary);
  const selectedPc = selectPc(defaultPcRoutes, {
    taskClass: "ORCHESTRATOR",
    requiredCapabilities: [],
    availableCapabilitiesByPc: {
      [contract.execution.pcId]: ["git", "node", "codex"],
    },
  });
  if (selectedPc !== contract.execution.pcId) {
    throw new Error("TaskContract PC does not match deterministic routing");
  }

  const now = options.now ?? (() => new Date().toISOString());
  const ledger = new OrchestratorLedger(options.ledgerPath, repositoryRoot);
  try {
    const timestamp = now();
    const repoId = repositoryId(contract.repository.canonicalOrigin);
    ledger.registerProject(contract.projectId, timestamp);
    ledger.registerRepository({
      repositoryId: repoId,
      canonicalOrigin: contract.repository.canonicalOrigin,
      integrationBranch: contract.repository.baseBranch,
      now: timestamp,
    });
    ledger.registerPc(selectedPc, "git,node,codex", timestamp);
    const registration = ledger.createTask(
      {
        projectId: contract.projectId,
        taskId: contract.taskId,
        parentTaskId: contract.parentTaskId ?? null,
        idempotencyKey: contract.execution.idempotencyKey,
      },
      timestamp,
    );
    if (registration === "CREATED") {
      ledger.assignRoute(
        {
          taskId: contract.taskId,
          repositoryId: repoId,
          pcId: selectedPc,
          branch: contract.repository.workBranch,
          worktreePath: repositoryRoot,
        },
        timestamp,
      );
    }
    const worker =
      options.workerFactory?.(boundary, contract.objective) ??
      new AppServerWorkerAdapter({
        goal: contract.objective,
        correlationId: contract.taskId,
        workspace: boundary,
      });
    const runId = options.runId ?? `${contract.taskId}:run:1`;
    const results = await runDevelopmentLoop(
      ledger,
      worker,
      () => {
        if (worker instanceof AppServerWorkerAdapter) {
          return worker.interrupt();
        }
        return Promise.resolve();
      },
      {
        first: {
          projectId: contract.projectId,
          taskId: contract.taskId,
          runId,
          idempotencyKey: `${contract.execution.idempotencyKey}:run:1`,
          controllerId: contract.execution.controllerId,
          leaseExpiresAt: new Date(Date.parse(timestamp) + contract.budgets.wallTimeMinutes * 60_000).toISOString(),
          now,
          budget: {
            tokenLimit: contract.budgets.tokenLimit,
            wallTimeSeconds: contract.budgets.wallTimeMinutes * 60,
            estimatedCostKrwLimit: contract.budgets.costKrwLimit,
          },
          verificationPlan: {
            repositoryRoot,
            requiredCommandIds: verificationIds(contract),
            retryableOnFailure: true,
          },
        },
        nextRunId: (attempt) => `${contract.taskId}:run:${attempt}`,
        nextIdempotencyKey: (attempt) =>
          `${contract.execution.idempotencyKey}:run:${attempt}`,
      },
      options.verifier,
    );
    const final = results.at(-1);
    if (final === undefined) {
      throw new Error("Development loop returned no result");
    }
    return sanitizeOrchestratorValue({
      taskId: contract.taskId,
      finalState: final.run.state,
      attempts: results.length,
      lifecycle: createDeliveryLifecycle(contract.taskId),
      evidence: finalEvidence(final),
    }) as OperatorSummary;
  } finally {
    ledger.close();
  }
}

async function main(): Promise<void> {
  const [taskContractPath, ledgerPath] = process.argv.slice(2);
  if (taskContractPath === undefined || ledgerPath === undefined) {
    throw new Error("Usage: operator <task-contract.json> <absolute-ledger.sqlite>");
  }
  const summary = await runSupervisedOperator({ taskContractPath, ledgerPath });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    const summary = sanitizeOrchestratorValue({
      taskId: "unknown",
      finalState: "FAILED",
      attempts: 0,
      lifecycle: createDeliveryLifecycle("unknown"),
      evidence: [
        error instanceof Error ? error.message : "Unknown operator failure",
      ],
    });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    process.exitCode = 1;
  });
}
