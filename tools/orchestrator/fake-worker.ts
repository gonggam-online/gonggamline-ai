import type {
  WorkerAdapter,
  WorkerExecutionContext,
  WorkerHooks,
  WorkerOutcome,
} from "./execution.ts";

export interface FakeWorkerStep {
  readonly checkpointKind: string;
  readonly checkpointPayload: unknown;
}

export class FakeWorkerAdapter implements WorkerAdapter {
  readonly name = "fake-safe-worker";

  constructor(
    private readonly outcome: WorkerOutcome,
    private readonly steps: readonly FakeWorkerStep[] = [],
  ) {}

  async execute(
    _context: WorkerExecutionContext,
    hooks: WorkerHooks,
  ): Promise<WorkerOutcome> {
    for (const step of this.steps) {
      hooks.checkpoint({
        kind: step.checkpointKind,
        payload: step.checkpointPayload,
      });
    }
    return this.outcome;
  }
}
