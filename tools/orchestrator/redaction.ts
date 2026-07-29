const sensitiveKey =
  /(?:authorization|cookie|secret|token|api[-_]?key|anon[-_]?key|password)/i;

function redactText(value: string): string {
  return value
    .replace(/(?:Bearer\s+)[^\s]+/gi, "Bearer [redacted]")
    .replace(
      /(api[_-]?key|anon[_-]?key|token|secret|password)\s*[=:]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(/\b(?:sk|sb_secret)_[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
    .slice(0, 500);
}

export function sanitizeOrchestratorValue(
  value: unknown,
  depth = 0,
): unknown {
  if (depth >= 5) {
    return "[truncated]";
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((entry) => sanitizeOrchestratorValue(entry, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, entry]) => [
          key,
          sensitiveKey.test(key)
            ? "[redacted]"
            : sanitizeOrchestratorValue(entry, depth + 1),
        ]),
    );
  }
  if (typeof value === "string") {
    return redactText(value);
  }
  return value;
}

export function sanitizeOrchestratorText(value: string): string {
  return redactText(value);
}
