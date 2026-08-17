import {
  OPENAI_LISTING_IMAGE_MODEL,
  OPENAI_LISTING_IMAGE_PROVIDER_ID,
} from "@/engines/listing/openai-image-provider";

export type ListingCreativeProviderPreflight = Readonly<{
  status: "READY" | "PRODUCTION_REQUIRED" | "OPENAI_API_KEY_MISSING";
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
