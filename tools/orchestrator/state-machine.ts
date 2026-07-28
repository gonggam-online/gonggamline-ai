export const taskStates = [
  "PLANNED",
  "READY",
  "RUNNING",
  "VERIFYING",
  "WAITING_FOR_CI",
  "WAITING_FOR_HUMAN",
  "RETRYABLE_FAILURE",
  "REPLANNING",
  "BLOCKED",
  "FAILED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type TaskState = (typeof taskStates)[number];

const transitions: Readonly<Record<TaskState, readonly TaskState[]>> = {
  PLANNED: ["READY", "REPLANNING", "CANCELLED"],
  READY: ["RUNNING", "WAITING_FOR_HUMAN", "CANCELLED"],
  RUNNING: [
    "VERIFYING",
    "WAITING_FOR_HUMAN",
    "RETRYABLE_FAILURE",
    "BLOCKED",
    "FAILED",
    "CANCELLED",
  ],
  VERIFYING: [
    "WAITING_FOR_CI",
    "WAITING_FOR_HUMAN",
    "RETRYABLE_FAILURE",
    "REPLANNING",
    "BLOCKED",
    "COMPLETED",
    "FAILED",
  ],
  WAITING_FOR_CI: [
    "VERIFYING",
    "RETRYABLE_FAILURE",
    "WAITING_FOR_HUMAN",
    "BLOCKED",
    "CANCELLED",
  ],
  WAITING_FOR_HUMAN: [
    "READY",
    "RUNNING",
    "VERIFYING",
    "WAITING_FOR_CI",
    "REPLANNING",
    "BLOCKED",
    "CANCELLED",
  ],
  RETRYABLE_FAILURE: ["READY", "RUNNING", "REPLANNING", "FAILED", "CANCELLED"],
  REPLANNING: ["PLANNED", "WAITING_FOR_HUMAN", "BLOCKED", "FAILED", "CANCELLED"],
  BLOCKED: ["REPLANNING", "READY", "CANCELLED", "FAILED"],
  FAILED: [],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: TaskState, to: TaskState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Forbidden task transition: ${from} -> ${to}`);
  }
}
