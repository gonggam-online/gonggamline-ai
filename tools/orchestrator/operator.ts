import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { AppServerWorkerAdapter } from "./app-server-worker.ts";
import { createContractValidators } from "./contracts.ts";
import { runDevelopmentLoop } from "./development-loop.ts";
import {
  localDeliveryCommandRunner,
  type DeliveryCommandRunner,
} from "./delivery-actions.ts";
import {
  runDeliveryPipeline,
  type DeliveryPipelineResult,
} from "./delivery-pipeline.ts";
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
  readonly taskKind: string;
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
  readonly risk: {
    readonly requiredLabel: string;
  };
}

export interface OperatorSummary {
  readonly taskId: string;
  readonly finalState: string;
  readonly attempts: number;
  readonly lifecycle: DeliveryLifecycle;
  readonly evidence: readonly string[];
  readonly delivery: DeliveryPipelineResult | null;
}

export interface DeliverySubmission {
  readonly paths: readonly string[];
  readonly commitMessage: string;
  readonly pullRequestTitle: string;
  readonly pullRequestBodyFile: string;
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
  readonly delivery?: DeliverySubmission;
  readonly deliveryRunner?: DeliveryCommandRunner;
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

function deliverySubmission(value: unknown): DeliverySubmission {
  if (
    typeof value !== "object" ||
    value === null ||
    !("paths" in value) ||
    !Array.isArray(value.paths) ||
    value.paths.length === 0 ||
    value.paths.some((entry) => typeof entry !== "string" || entry.length === 0) ||
    !("commitMessage" in value) ||
    typeof value.commitMessage !== "string" ||
    value.commitMessage.length === 0 ||
    !("pullRequestTitle" in value) ||
    typeof value.pullRequestTitle !== "string" ||
    value.pullRequestTitle.length === 0 ||
    !("pullRequestBodyFile" in value) ||
    typeof value.pullRequestBodyFile !== "string" ||
    value.pullRequestBodyFile.length === 0
  ) {
    throw new Error("Delivery submission is invalid");
  }
  return value as unknown as DeliverySubmission;
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

function repositoryFullName(origin: string): string {
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(origin);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error("Canonical origin is not a supported GitHub repository");
  }
  return `${match[1]}/${match[2]}`;
}

function taskClass(contract: TaskContract): string {
  return contract.taskKind === "IMPLEMENTATION"
    ? "APPROVED_PRODUCT_IMPLEMENTATION"
    : "ORCHESTRATOR";
}

function existingRun(
  ledger: OrchestratorLedger,
  runId: string,
): ReturnType<OrchestratorLedger["run"]> | null {
  try {
    return ledger.run(runId);
  } catch (error) {
    if (error instanceof Error && error.message === `Unknown run: ${runId}`) {
      return null;
    }
    throw error;
  }
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
  const selectedPc = selectPc(defaultPcRoutes, {
    taskClass: taskClass(contract),
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
    const runId = options.runId ?? `${contract.taskId}:run:1`;
    const priorRun = existingRun(ledger, runId);
    let final: RunExecutionResult;
    let attempts: number;
    if (priorRun?.state === "COMPLETED" && options.delivery !== undefined) {
      final = { run: priorRun, outcome: null };
      attempts = priorRun.attempt;
    } else {
      inspectExecutionWorkspace(boundary);
      const worker =
        options.workerFactory?.(boundary, contract.objective) ??
        new AppServerWorkerAdapter({
          goal: contract.objective,
          correlationId: contract.taskId,
          workspace: boundary,
        });
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
      const completed = results.at(-1);
      if (completed === undefined) {
        throw new Error("Development loop returned no result");
      }
      final = completed;
      attempts = results.length;
    }
    const delivery =
      final.run.state === "COMPLETED" && options.delivery !== undefined
        ? runDeliveryPipeline(
            ledger,
            {
              commit: {
                identity: {
                  repositoryRoot,
                  repositoryFullName: repositoryFullName(
                    contract.repository.canonicalOrigin,
                  ),
                  baseBranch: contract.repository.baseBranch,
                  baseSha: contract.repository.baseSha,
                  branch: contract.repository.workBranch,
                  taskId: contract.taskId,
                },
                paths: options.delivery.paths,
                message: options.delivery.commitMessage,
                idempotencyKey: `${contract.execution.idempotencyKey}:commit`,
              },
              pushIdempotencyKey: `${contract.execution.idempotencyKey}:push`,
              pullRequest: {
                title: options.delivery.pullRequestTitle,
                bodyFile: path.resolve(options.delivery.pullRequestBodyFile),
                requiredLabel: contract.risk.requiredLabel,
                idempotencyKey: `${contract.execution.idempotencyKey}:pr`,
              },
              requiredWorkflowNames: ["CI", "Preview browser validation"],
            },
            options.deliveryRunner ?? localDeliveryCommandRunner,
          )
        : null;
    return sanitizeOrchestratorValue({
      taskId: contract.taskId,
      finalState: delivery?.state ?? final.run.state,
      attempts,
      lifecycle: createDeliveryLifecycle(contract.taskId),
      evidence: finalEvidence(final),
      delivery,
    }) as OperatorSummary;
  } finally {
    ledger.close();
  }
}

async function main(): Promise<void> {
  const [taskContractPath, ledgerPath, deliverySubmissionPath] =
    process.argv.slice(2);
  if (taskContractPath === undefined || ledgerPath === undefined) {
    throw new Error(
      "Usage: operator <task-contract.json> <absolute-ledger.sqlite> [delivery-submission.json]",
    );
  }
  const delivery =
    deliverySubmissionPath === undefined
      ? undefined
      : deliverySubmission(readJson(path.resolve(deliverySubmissionPath)));
  const summary = await runSupervisedOperator({
    taskContractPath,
    ledgerPath,
    delivery,
  });
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
      delivery: null,
    });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    process.exitCode = 1;
  });
}
