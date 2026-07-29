import {
  OrchestratorExecutionEngine,
  type RunExecutionRequest,
  type RunExecutionResult,
  type RunVerifier,
  type WorkerAdapter,
} from "./execution.ts";
import type { OrchestratorLedger } from "./ledger.ts";

export interface DevelopmentLoopRequest {
  readonly first: RunExecutionRequest;
  nextRunId(attempt: number): string;
  nextIdempotencyKey(attempt: number): string;
}

export async function runDevelopmentLoop(
  ledger: OrchestratorLedger,
  worker: WorkerAdapter,
  interrupt: () => Promise<void>,
  request: DevelopmentLoopRequest,
  verifier?: RunVerifier,
): Promise<readonly RunExecutionResult[]> {
  const engine = new OrchestratorExecutionEngine(
    ledger,
    worker,
    interrupt,
    verifier,
  );
  const results: RunExecutionResult[] = [];
  let current = await engine.execute(request.first);
  results.push(current);
  while (current.run.state === "RETRYABLE_FAILURE") {
    const attempt = current.run.attempt + 1;
    current = await engine.retry(current.run.runId, {
      ...request.first,
      runId: request.nextRunId(attempt),
      idempotencyKey: request.nextIdempotencyKey(attempt),
    });
    results.push(current);
  }
  return results;
}
