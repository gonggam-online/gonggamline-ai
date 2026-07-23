import type { RuntimeJobStatus } from "@/types/revenue";

export const MAX_RUNTIME_ATTEMPTS = 10;
export const CLAIMABLE_JOB_STATUSES = ["queued", "retry"] as const;
export const RETRYABLE_JOB_STATUSES = ["failed", "waiting"] as const;
export const CANCELLABLE_JOB_STATUSES = ["queued", "retry", "waiting"] as const;

export function boundedMaxAttempts(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 3;
  return Math.min(parsed, MAX_RUNTIME_ATTEMPTS);
}

export function canAttemptJob(attempts: unknown, maxAttempts: unknown): boolean {
  return Math.max(0, Number(attempts) || 0) < boundedMaxAttempts(maxAttempts);
}

export function canTransitionRuntimeJob(current: RuntimeJobStatus, next: RuntimeJobStatus): boolean {
  const transitions: Record<RuntimeJobStatus, readonly RuntimeJobStatus[]> = {
    queued: ["running", "archived"],
    running: ["completed", "failed", "retry"],
    waiting: ["retry", "archived"],
    completed: ["archived"],
    failed: ["retry", "archived"],
    retry: ["running", "archived"],
    archived: [],
  };
  return transitions[current].includes(next);
}

export function serializeRuntimeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Worker execution failed";
  return raw
    .replace(/(?:Bearer\s+)[^\s]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 500);
}
