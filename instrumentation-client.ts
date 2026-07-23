import { isRawRuntimeError, NO_DATA_MESSAGE } from "@/lib/runtime-errors";

const nativeFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const requestUrl = input instanceof Request ? input.url : String(input);
  const isInternalApi =
    requestUrl.startsWith("/api/") ||
    requestUrl.startsWith(`${window.location.origin}/api/`);

  if (!isInternalApi) {
    return nativeFetch(input, init);
  }

  try {
    const response = await nativeFetch(input, init);
    const contentType = response.headers.get("content-type") ?? "";

    if (response.ok) {
      return response;
    }

    if (!contentType.includes("application/json")) {
      return Response.json(
        { success: false, message: NO_DATA_MESSAGE },
        { status: response.status || 503 },
      );
    }

    const body: unknown = await response.clone().json().catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      isRawRuntimeError(body.message)
    ) {
      return Response.json(
        { ...body, message: NO_DATA_MESSAGE },
        { status: response.status },
      );
    }

    return response;
  } catch {
    return Response.json(
      { success: false, message: NO_DATA_MESSAGE },
      { status: 503 },
    );
  }
};
