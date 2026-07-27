export type DomeggookErrorCode =
  | "CONFIGURATION_MISSING"
  | "AUTHENTICATION_FAILED"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "RESPONSE_CONTRACT_ERROR";

const RETRYABLE_CODES = new Set<DomeggookErrorCode>([
  "RATE_LIMITED",
  "TIMEOUT",
  "NETWORK_ERROR",
  "PROVIDER_ERROR",
]);

export class DomeggookError extends Error {
  readonly code: DomeggookErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    code: DomeggookErrorCode,
    options: {
      status?: number;
      retryAfterMs?: number | null;
      cause?: unknown;
    } = {}
  ) {
    super("Domeggook integration is unavailable.", { cause: options.cause });
    this.name = "DomeggookError";
    this.code = code;
    this.retryable = RETRYABLE_CODES.has(code);
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

export function domeggookErrorHttpStatus(code: DomeggookErrorCode): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return 400;
    case "RATE_LIMITED":
      return 429;
    case "AUTHENTICATION_FAILED":
    case "PROVIDER_ERROR":
    case "RESPONSE_CONTRACT_ERROR":
      return 502;
    case "CONFIGURATION_MISSING":
    case "NETWORK_ERROR":
      return 503;
    case "TIMEOUT":
      return 504;
  }
}
