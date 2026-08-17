import {
  OPENAI_LISTING_IMAGE_MODEL,
  OPENAI_LISTING_IMAGE_PROVIDER_ID,
} from "@/engines/listing/openai-image-provider";

export type ListingCreativeProviderPreflight = Readonly<{
  status:
    | "READY"
    | "PRODUCTION_REQUIRED"
    | "OPENAI_API_KEY_MISSING"
    | "OPENAI_API_KEY_INVALID"
    | "OPENAI_MODEL_ACCESS_DENIED"
    | "OPENAI_PREFLIGHT_UNAVAILABLE";
  providerId: typeof OPENAI_LISTING_IMAGE_PROVIDER_ID;
  modelVersion: typeof OPENAI_LISTING_IMAGE_MODEL;
}>;

export function preflightProductionListingCreativeProvider(
  environment: Readonly<Record<string, string | undefined>>,
): ListingCreativeProviderPreflight {
  const status = environment.VERCEL_ENV !== "production"
    ? "PRODUCTION_REQUIRED"
    : !environment.OPENAI_API_KEY?.trim()
      ? "OPENAI_API_KEY_MISSING"
      : "READY";
  return Object.freeze({
    status,
    providerId: OPENAI_LISTING_IMAGE_PROVIDER_ID,
    modelVersion: OPENAI_LISTING_IMAGE_MODEL,
  });
}

type PreflightFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Performs a non-billable model metadata request. It never sends a prompt or
 * image and returns only a stable status; the key and upstream body are never
 * included in the result.
 */
export async function probeProductionListingCreativeProvider(
  environment: Readonly<Record<string, string | undefined>>,
  fetcher: PreflightFetch = fetch,
): Promise<ListingCreativeProviderPreflight> {
  const staticResult = preflightProductionListingCreativeProvider(environment);
  if (staticResult.status !== "READY") return staticResult;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetcher(
      `https://api.openai.com/v1/models/${encodeURIComponent(staticResult.modelVersion)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${environment.OPENAI_API_KEY!.trim()}` },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (response.ok) return staticResult;
    return Object.freeze({
      ...staticResult,
      status: response.status === 401
        ? "OPENAI_API_KEY_INVALID"
        : response.status === 403 || response.status === 404
          ? "OPENAI_MODEL_ACCESS_DENIED"
          : "OPENAI_PREFLIGHT_UNAVAILABLE",
    });
  } catch {
    return Object.freeze({ ...staticResult, status: "OPENAI_PREFLIGHT_UNAVAILABLE" });
  } finally {
    clearTimeout(timeout);
  }
}
