const RAW_RUNTIME_ERROR =
  /fetch failed|failed to fetch|typeerror|networkerror|econnrefused|enotfound|aborterror|추천 생성 오류/i;

export const NO_DATA_MESSAGE = "No data available";

export function publicErrorMessage(
  error: unknown,
  fallback = NO_DATA_MESSAGE,
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (!message || RAW_RUNTIME_ERROR.test(message)) {
    return fallback;
  }

  return message;
}

export function isRawRuntimeError(message: unknown): boolean {
  return typeof message === "string" && RAW_RUNTIME_ERROR.test(message);
}
