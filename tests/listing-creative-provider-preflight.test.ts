import test from "node:test";
import assert from "node:assert/strict";

import { OPENAI_LISTING_IMAGE_MODEL, OPENAI_LISTING_IMAGE_PROVIDER_ID } from "../engines/listing/openai-image-provider";
import {
  preflightProductionListingCreativeProvider,
  probeProductionListingCreativeProvider,
} from "../engines/listing/provider-preflight";

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

test("provider preflight verifies model access without sending a generation request", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const result = await probeProductionListingCreativeProvider(
    { VERCEL_ENV: "production", OPENAI_API_KEY: "secret" },
    async (input, init) => {
      requestedUrl = input;
      requestedMethod = init?.method ?? "";
      return new Response(JSON.stringify({ id: OPENAI_LISTING_IMAGE_MODEL }), { status: 200 });
    },
  );
  assert.equal(result.status, "READY");
  assert.equal(requestedMethod, "GET");
  assert.match(requestedUrl, /\/v1\/models\//);
  assert.equal("apiKey" in result, false);
});

test("provider preflight classifies denied model access without exposing upstream data", async () => {
  const result = await probeProductionListingCreativeProvider(
    { VERCEL_ENV: "production", OPENAI_API_KEY: "secret" },
    async () => new Response("private upstream body", { status: 403 }),
  );
  assert.equal(result.status, "OPENAI_MODEL_ACCESS_DENIED");
});
