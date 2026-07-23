export type NetworkFailureReason =
  | "dns_not_found"
  | "connection_refused"
  | "connection_timeout"
  | "tls_error"
  | "network_unreachable"
  | "fetch_failed"
  | "unknown";

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  cause?: unknown;
};

function asErrorLike(value: unknown): ErrorLike | null {
  return value && typeof value === "object" ? value as ErrorLike : null;
}

export function findNetworkErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = asErrorLike(current);
    if (!candidate) return null;
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return null;
}

export function classifyNetworkError(error: unknown): NetworkFailureReason {
  const code = findNetworkErrorCode(error);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns_not_found";
  if (code === "ECONNREFUSED") return "connection_refused";
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return "connection_timeout";
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") return "network_unreachable";
  if (code?.startsWith("ERR_TLS") || code?.startsWith("CERT_")
    || code === "DEPTH_ZERO_SELF_SIGNED_CERT") return "tls_error";

  const message = asErrorLike(error)?.message;
  return typeof message === "string" && /fetch failed/i.test(message)
    ? "fetch_failed" : "unknown";
}
