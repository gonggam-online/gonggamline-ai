import { createHash } from "node:crypto";

import { BudgetExceededError, BudgetGuard, type UsageSnapshot } from "./budget.ts";
import {
  OrchestratorLedger,
  type OrchestratorRun,
  type RunCheckpoint,
} from "./ledger.ts";
import type { TaskState } from "./state-machine.ts";

export interface WorkerExecutionContext {
  readonly taskId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly retryOfRunId: string | null;
  readonly resumedFrom: RunCheckpoint | null;
}

export type WorkerOutcome =
  | {
      readonly kind: "SUCCEEDED";
      readonly summary: string;
      readonly output: unknown;
      readonly evidence: readonly string[];
    }
  | {
      readonly kind: "FAILED";
      readonly summary: string;
      readonly errorCode: string;
      readonly retryable: boolean;
      readonly evidence: readonly string[];
    }
  | {
      readonly kind: "WAITING_FOR_HUMAN";
      readonly summary: string;
      readonly approvalReason: string;
      readonly evidence: readonly string[];
    };

export interface WorkerHooks {
  checkpoint(checkpoint: {
    readonly kind: string;
    readonly payload: unknown;
  }): void;
  observeUsage(usage: UsageSnapshot): Promise<void>;
}

export interface WorkerAdapter {
  readonly name: string;
  execute(
    context: WorkerExecutionContext,
    hooks: WorkerHooks,
  ): Promise<WorkerOutcome>;
}

export interface RunExecutionRequest {
  readonly projectId: string;
  readonly taskId: string;
  readonly runId: string;
  readonly idempotencyKey: string;
  readonly controllerId: string;
  readonly leaseExpiresAt: string;
  readonly now: () => string;
  readonly budget: {
    readonly tokenLimit: number;
    readonly wallTimeSeconds: number;
    readonly estimatedCostKrwLimit: number;
  };
}

export interface RunExecutionResult {
  readonly run: OrchestratorRun;
  readonly outcome: WorkerOutcome | null;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function terminalState(outcome: WorkerOutcome): TaskState {
  if (outcome.kind === "SUCCEEDED") {
    return "COMPLETED";
  }
  if (outcome.kind === "WAITING_FOR_HUMAN") {
    return "WAITING_FOR_HUMAN";
  }
  return outcome.retryable ? "RETRYABLE_FAILURE" : "FAILED";
}

export class OrchestratorExecutionEngine {
  constructor(
    private readonly ledger: OrchestratorLedger,
    private readonly worker: WorkerAdapter,
    private readonly interrupt: () => Promise<void>,
  ) {}

  async execute(request: RunExecutionRequest): Promise<RunExecutionResult> {
    const createResult = this.ledger.createRun(
      {
        projectId: request.projectId,
        taskId: request.taskId,
        runId: request.runId,
        retryOfRunId: null,
        idempotencyKey: request.idempotencyKey,
        workerAdapter: this.worker.name,
      },
      request.now(),
    );
    const existing = this.ledger.run(request.runId);
    if (createResult === "EXISTS") {
      return { run: existing, outcome: null };
    }
    return this.dispatch(existing, request);
  }

  async executeNextReady(
    request: Omit<RunExecutionRequest, "taskId">,
  ): Promise<RunExecutionResult | null> {
    const taskId = this.ledger.readyTaskIds(request.projectId)[0];
    if (taskId === undefined) {
      return null;
    }
    return this.execute({ ...request, taskId });
  }

  async retry(
    failedRunId: string,
    request: Omit<RunExecutionRequest, "taskId">,
  ): Promise<RunExecutionResult> {
    const failed = this.ledger.run(failedRunId);
    if (failed.state !== "RETRYABLE_FAILURE") {
      throw new Error("Only RETRYABLE_FAILURE runs may be retried");
    }
    if (failed.attempt >= failed.maxAttempts) {
      this.ledger.transitionRun(failedRunId, "FAILED", request.now());
      if (this.ledger.taskState(failed.taskId) === "RETRYABLE_FAILURE") {
        this.ledger.transition(failed.taskId, "FAILED", request.now());
      }
      throw new Error("Run retry ceiling exhausted");
    }
    const createResult = this.ledger.createRun(
      {
        projectId: request.projectId,
        taskId: failed.taskId,
        runId: request.runId,
        retryOfRunId: failedRunId,
        idempotencyKey: request.idempotencyKey,
        workerAdapter: this.worker.name,
      },
      request.now(),
    );
    const retryRun = this.ledger.run(request.runId);
    if (createResult === "EXISTS") {
      return { run: retryRun, outcome: null };
    }
    return this.dispatch(retryRun, { ...request, taskId: failed.taskId });
  }

  async resume(
    runId: string,
    request: Omit<RunExecutionRequest, "runId" | "taskId" | "idempotencyKey">,
  ): Promise<RunExecutionResult> {
    const run = this.ledger.run(runId);
    if (!["READY", "WAITING_FOR_HUMAN", "BLOCKED"].includes(run.state)) {
      throw new Error(`Run ${runId} cannot be resumed from ${run.state}`);
    }
    if (run.state !== "READY") {
      this.ledger.transitionRun(runId, "READY", request.now());
    }
    return this.dispatch(run, {
      ...request,
      taskId: run.taskId,
      runId,
      idempotencyKey: run.idempotencyKey,
    });
  }

  private async dispatch(
    run: OrchestratorRun,
    request: RunExecutionRequest,
  ): Promise<RunExecutionResult> {
    const resumedFrom = this.ledger.latestRunCheckpoint(run.runId);
    if (
      !this.ledger.acquireLease(
        {
          taskId: run.taskId,
          controllerId: request.controllerId,
          expiresAt: request.leaseExpiresAt,
        },
        request.now(),
      )
    ) {
      throw new Error("Task lease is owned by another controller");
    }

    const taskState = this.ledger.taskState(run.taskId);
    if (taskState === "PLANNED") {
      this.ledger.transition(run.taskId, "READY", request.now());
    }
    const readyTaskState = this.ledger.taskState(run.taskId);
    if (
      ["READY", "WAITING_FOR_HUMAN", "RETRYABLE_FAILURE", "BLOCKED"].includes(
        readyTaskState,
      )
    ) {
      this.ledger.transition(run.taskId, "RUNNING", request.now());
    } else if (readyTaskState !== "RUNNING") {
      throw new Error(`Task ${run.taskId} cannot dispatch from ${readyTaskState}`);
    }

    if (run.state === "PLANNED") {
      this.ledger.transitionRun(run.runId, "READY", request.now());
    }
    this.ledger.transitionRun(run.runId, "RUNNING", request.now());
    this.ledger.appendRunCheckpoint(
      run.runId,
      {
        kind: "WORKER_DISPATCHED",
        payload: { adapter: this.worker.name },
      },
      request.now(),
    );

    const budget = new BudgetGuard(request.budget, this.interrupt);
    const hooks: WorkerHooks = {
      checkpoint: (checkpoint): void => {
        this.ledger.appendRunCheckpoint(run.runId, checkpoint, request.now());
      },
      observeUsage: async (usage): Promise<void> => {
        this.ledger.appendRunCheckpoint(
          run.runId,
          { kind: "USAGE", payload: usage },
          request.now(),
        );
        await budget.observe(usage);
      },
    };

    let outcome: WorkerOutcome;
    try {
      outcome = await this.worker.execute(
        {
          taskId: run.taskId,
          runId: run.runId,
          attempt: run.attempt,
          retryOfRunId: run.retryOfRunId,
          resumedFrom,
        },
        hooks,
      );
    } catch (error) {
      const budgetExceeded = error instanceof BudgetExceededError;
      outcome = {
        kind: "FAILED",
        summary: budgetExceeded
          ? "Execution budget exceeded"
          : "Worker adapter failed",
        errorCode: budgetExceeded ? error.dimension : "WORKER_ADAPTER_ERROR",
        retryable: !budgetExceeded,
        evidence: [],
      };
    }

    if (outcome.kind === "WAITING_FOR_HUMAN") {
      this.ledger.appendRunCheckpoint(
        run.runId,
        {
          kind: "APPROVAL_REQUIRED",
          payload: {
            reason: outcome.approvalReason,
            evidence: outcome.evidence,
          },
        },
        request.now(),
      );
      this.ledger.transitionRun(
        run.runId,
        "WAITING_FOR_HUMAN",
        request.now(),
      );
      this.ledger.transition(
        run.taskId,
        "WAITING_FOR_HUMAN",
        request.now(),
      );
      return { run: this.ledger.run(run.runId), outcome };
    }

    this.ledger.transitionRun(run.runId, "VERIFYING", request.now());
    this.ledger.transition(run.taskId, "VERIFYING", request.now());
    this.ledger.recordRunResult(
      run.runId,
      {
        outcome: outcome.kind,
        summary: outcome.summary,
        outputHash:
          outcome.kind === "SUCCEEDED" ? sha256(outcome.output) : null,
        evidence: outcome.evidence,
        failureCode: outcome.kind === "FAILED" ? outcome.errorCode : null,
        approvalReason: null,
      },
      request.now(),
    );
    this.ledger.transitionRun(run.runId, terminalState(outcome), request.now());
    this.ledger.transition(run.taskId, terminalState(outcome), request.now());
    return { run: this.ledger.run(run.runId), outcome };
  }
}
