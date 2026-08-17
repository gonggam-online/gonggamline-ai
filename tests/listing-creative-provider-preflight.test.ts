import test from "node:test";
import assert from "node:assert/strict";

import { OPENAI_LISTING_IMAGE_MODEL, OPENAI_LISTING_IMAGE_PROVIDER_ID } from "../engines/listing/openai-image-provider";
import { preflightProductionListingCreativeProvider } from "../engines/listing/provider-preflight";

test("provider preflight reports missing Production configuration without exposing a secret", () => {
  const result = preflightProductionListingCreativeProvider({ VERCEL_ENV: "production" });
  assert.equal(result.status, "OPENAI_API_KEY_MISSING");
  assert.equal(result.providerId, OPENAI_LISTING_IMAGE_PROVIDER_ID);
  assert.equal(result.modelVersion, OPENAI_LISTING_IMAGE_MODEL);
  assert.equal("apiKey" in result, false);
});

test("provider preflight is ready only for Production with a non-empty key", () => {
  assert.equal(
    preflightProductionListingCreativeProvider({ VERCEL_ENV: "preview", OPENAI_API_KEY: "key" }).status,
    "PRODUCTION_REQUIRED",
  );
  assert.equal(
    preflightProductionListingCreativeProvider({ VERCEL_ENV: "production", OPENAI_API_KEY: "  key  " }).status,
    "READY",
  );
});
