export const CENTRAL_RUNNER_SCHEMA_VERSION = "1.0.0" as const;

export const centralRunnerOperations = [
  "COUPANG_CONNECTION_TEST",
  "COUPANG_CATEGORY_META",
] as const;

export type CentralRunnerOperation = (typeof centralRunnerOperations)[number];

export interface CentralRunnerRequest {
  readonly schemaVersion: typeof CENTRAL_RUNNER_SCHEMA_VERSION;
  readonly taskId: string;
  readonly sourceProject: string;
  readonly operation: CentralRunnerOperation;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface CentralRunnerResponse {
  readonly schemaVersion: typeof CENTRAL_RUNNER_SCHEMA_VERSION;
  readonly taskId: string;
  readonly ok: boolean;
  readonly status: number;
  readonly completedAt: string;
  readonly result?: unknown;
  readonly errorCode?: string;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const IDEMPOTENCY_KEY = /^sha256:[a-f0-9]{64}$/;

export function parseCentralRunnerRequest(value: unknown, now = new Date()): CentralRunnerRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("INVALID_REQUEST");
  }
  const request = value as Partial<CentralRunnerRequest>;
  if (
    request.schemaVersion !== CENTRAL_RUNNER_SCHEMA_VERSION ||
    typeof request.taskId !== "string" ||
    !SAFE_ID.test(request.taskId) ||
    typeof request.sourceProject !== "string" ||
    !SAFE_ID.test(request.sourceProject) ||
    !centralRunnerOperations.includes(request.operation as CentralRunnerOperation) ||
    typeof request.requestedAt !== "string" ||
    typeof request.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(request.requestedAt)) ||
    !Number.isFinite(Date.parse(request.expiresAt)) ||
    Date.parse(request.expiresAt) <= now.getTime() ||
    typeof request.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY.test(request.idempotencyKey) ||
    typeof request.arguments !== "object" ||
    request.arguments === null ||
    Array.isArray(request.arguments)
  ) {
    throw new Error("INVALID_REQUEST");
  }
  return request as CentralRunnerRequest;
}

export function categoryCode(request: CentralRunnerRequest): string {
  const value = request.arguments.displayCategoryCode;
  if (request.operation !== "COUPANG_CATEGORY_META" || typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("INVALID_ARGUMENTS");
  }
  return value;
}
