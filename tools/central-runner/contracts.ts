export const WING_READ_CONTRACT_VERSION = "1.0.0" as const;
export const WING_READ_REQUEST_TYPE = "wing.read.request" as const;
export const WING_READ_RESPONSE_TYPE = "wing.read.response" as const;
export const WING_READ_SOURCE = "picktil-discovery" as const;

export const wingReadOperations = [
  "connection_test",
  "list_seller_products",
  "category_meta",
] as const;

export type WingReadOperation = (typeof wingReadOperations)[number];
export type WingReadStatus = "succeeded" | "failed" | "rejected" | "expired";

export interface WingReadRequest {
  readonly contractVersion: typeof WING_READ_CONTRACT_VERSION;
  readonly messageType: typeof WING_READ_REQUEST_TYPE;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly requestedAt: string;
  readonly expiresAt: string;
  readonly source: typeof WING_READ_SOURCE;
  readonly operation: WingReadOperation;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface WingReadError {
  readonly code: string;
  readonly retryable: boolean;
}

export interface WingReadResponse {
  readonly contractVersion: typeof WING_READ_CONTRACT_VERSION;
  readonly messageType: typeof WING_READ_RESPONSE_TYPE;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly respondedAt: string;
  readonly operation: string;
  readonly status: WingReadStatus;
  readonly result?: unknown;
  readonly error?: WingReadError;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_OPERATION = /^[a-z][a-z0-9_]{2,63}$/;
const MAX_REQUEST_AGE_MS = 15 * 60_000;
const MAX_FUTURE_SKEW_MS = 60_000;

export class WingRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: "rejected" | "expired",
    readonly correlation: {
      readonly requestId: string;
      readonly idempotencyKey: string;
      readonly operation: string;
    } | null,
  ) {
    super(code);
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function correlation(value: Record<string, unknown>): WingRequestError["correlation"] {
  return typeof value.requestId === "string" && UUID.test(value.requestId) &&
    typeof value.idempotencyKey === "string" && SAFE_IDEMPOTENCY.test(value.idempotencyKey) &&
    typeof value.operation === "string" && SAFE_OPERATION.test(value.operation)
    ? {
        requestId: value.requestId,
        idempotencyKey: value.idempotencyKey,
        operation: value.operation,
      }
    : null;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validParameters(operation: WingReadOperation, value: Record<string, unknown>): boolean {
  if (operation === "connection_test") return Object.keys(value).length === 0;
  if (operation === "category_meta") {
    return exactKeys(value, ["displayCategoryCode"]) &&
      typeof value.displayCategoryCode === "string" &&
      /^[1-9]\d{0,11}$/.test(value.displayCategoryCode);
  }
  if (!exactKeys(value, ["maxPerPage", "nextToken"])) return false;
  const maxPerPage = value.maxPerPage;
  const nextToken = value.nextToken;
  return (maxPerPage === undefined ||
      (typeof maxPerPage === "number" && Number.isInteger(maxPerPage) && maxPerPage >= 1 && maxPerPage <= 100)) &&
    (nextToken === undefined ||
      (typeof nextToken === "string" && nextToken.length >= 1 && nextToken.length <= 512));
}

export function parseWingReadRequest(value: unknown, now = new Date()): WingReadRequest {
  const candidate = object(value);
  if (candidate === null) throw new WingRequestError("INVALID_REQUEST", "rejected", null);
  const correlated = correlation(candidate);
  if (
    !exactKeys(candidate, [
      "contractVersion",
      "messageType",
      "requestId",
      "idempotencyKey",
      "requestedAt",
      "expiresAt",
      "source",
      "operation",
      "parameters",
    ]) ||
    candidate.contractVersion !== WING_READ_CONTRACT_VERSION ||
    candidate.messageType !== WING_READ_REQUEST_TYPE ||
    candidate.source !== WING_READ_SOURCE ||
    correlated === null ||
    typeof candidate.requestedAt !== "string" ||
    typeof candidate.expiresAt !== "string"
  ) {
    throw new WingRequestError("INVALID_REQUEST", "rejected", correlated);
  }

  const requestedAt = Date.parse(candidate.requestedAt);
  const expiresAt = Date.parse(candidate.expiresAt);
  if (!Number.isFinite(requestedAt) || !Number.isFinite(expiresAt)) {
    throw new WingRequestError("INVALID_REQUEST", "rejected", correlated);
  }
  if (expiresAt <= now.getTime()) {
    throw new WingRequestError("REQUEST_EXPIRED", "expired", correlated);
  }
  if (
    requestedAt > now.getTime() + MAX_FUTURE_SKEW_MS ||
    expiresAt <= requestedAt ||
    expiresAt - requestedAt > MAX_REQUEST_AGE_MS
  ) {
    throw new WingRequestError("INVALID_REQUEST_WINDOW", "rejected", correlated);
  }
  if (!wingReadOperations.includes(candidate.operation as WingReadOperation)) {
    throw new WingRequestError("OPERATION_NOT_ALLOWED", "rejected", correlated);
  }
  const parameters = object(candidate.parameters);
  const operation = candidate.operation as WingReadOperation;
  if (parameters === null || !validParameters(operation, parameters)) {
    throw new WingRequestError("INVALID_PARAMETERS", "rejected", correlated);
  }
  return candidate as unknown as WingReadRequest;
}

export function wingReadResponse(
  identity: Pick<WingReadResponse, "requestId" | "idempotencyKey" | "operation">,
  outcome:
    | { readonly status: "succeeded"; readonly result: unknown }
    | { readonly status: Exclude<WingReadStatus, "succeeded">; readonly error: WingReadError },
  now = new Date(),
): WingReadResponse {
  return {
    contractVersion: WING_READ_CONTRACT_VERSION,
    messageType: WING_READ_RESPONSE_TYPE,
    ...identity,
    respondedAt: now.toISOString(),
    ...outcome,
  };
}

export function sellerProductParameters(request: WingReadRequest): {
  readonly maxPerPage: number;
  readonly nextToken?: string;
} {
  if (request.operation !== "list_seller_products") throw new Error("INVALID_OPERATION");
  return {
    maxPerPage: typeof request.parameters.maxPerPage === "number" ? request.parameters.maxPerPage : 100,
    ...(typeof request.parameters.nextToken === "string" ? { nextToken: request.parameters.nextToken } : {}),
  };
}

export function categoryCode(request: WingReadRequest): string {
  const value = request.parameters.displayCategoryCode;
  if (request.operation !== "category_meta" || typeof value !== "string") throw new Error("INVALID_OPERATION");
  return value;
}
