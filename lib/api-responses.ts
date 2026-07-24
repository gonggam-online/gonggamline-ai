export function unavailableListResponse<const K extends string>(field: K) {
  return {
    success: true as const,
    available: false as const,
    data: [] as unknown[],
    [field]: [] as unknown[],
    message: "No data available",
  } as {
    success: true;
    available: false;
    data: unknown[];
    message: "No data available";
  } & Record<K, unknown[]>;
}

const EXPECTED_READ_UNAVAILABLE_CODES = new Set(["42P01", "PGRST200", "PGRST205"]);
const EXPECTED_NETWORK_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
]);

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
};

export function isExpectedReadUnavailableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") return false;
    const candidate = current as ErrorLike;
    if (current instanceof Error && current.name === "SupabaseUnavailableError") {
      return true;
    }
    if (typeof candidate.code === "string"
      && (EXPECTED_READ_UNAVAILABLE_CODES.has(candidate.code)
        || EXPECTED_NETWORK_CODES.has(candidate.code)
        || candidate.code.startsWith("ERR_TLS")
        || candidate.code.startsWith("CERT_"))) {
      return true;
    }
    if (typeof candidate.message === "string"
      && /fetch failed|relation .+ does not exist|could not find the table|schema cache/i.test(candidate.message)) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}
