export const deliveryStages = [
  "DEVELOPMENT",
  "COMMIT",
  "PUSH",
  "PULL_REQUEST",
  "CI",
  "PREVIEW",
] as const;

export type DeliveryStage = (typeof deliveryStages)[number];
export type DeliveryStageStatus =
  | "NOT_STARTED"
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "WAITING_FOR_HUMAN";

export interface DeliveryLifecycleStage {
  readonly stage: DeliveryStage;
  readonly status: DeliveryStageStatus;
  readonly externalWrite: boolean;
  readonly evidence: readonly string[];
}

export interface DeliveryLifecycle {
  readonly taskId: string;
  readonly stages: readonly DeliveryLifecycleStage[];
}

export function createDeliveryLifecycle(taskId: string): DeliveryLifecycle {
  return {
    taskId,
    stages: deliveryStages.map((stage) => ({
      stage,
      status: stage === "DEVELOPMENT" ? "READY" : "NOT_STARTED",
      externalWrite: stage !== "DEVELOPMENT",
      evidence: [],
    })),
  };
}
