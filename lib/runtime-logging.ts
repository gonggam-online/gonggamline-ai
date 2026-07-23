const SENSITIVE_KEY = /(?:authorization|cookie|secret|token|api[-_]?key|anon[-_]?key|password)/i;
const MAX_DEPTH = 4;

export function sanitizeRuntimeValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message.slice(0, 500) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeRuntimeValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeRuntimeValue(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string") return value.slice(0, 500);
  return value;
}

type RuntimeContext = Record<string, unknown>;

export const runtimeLog = {
  info(event: string, context: RuntimeContext = {}) {
    console.info("[runtime]", event, sanitizeRuntimeValue(context));
  },
  warn(event: string, context: RuntimeContext = {}) {
    console.warn("[runtime]", event, sanitizeRuntimeValue(context));
  },
  error(event: string, error: unknown, context: RuntimeContext = {}) {
    console.error("[runtime]", event, sanitizeRuntimeValue({ ...context, error }));
  },
};
