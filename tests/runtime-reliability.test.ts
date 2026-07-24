import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseAvailability } from "../lib/supabase.ts";
import { SupabaseUnavailableError } from "../lib/supabase.ts";
import {
  boundedMaxAttempts,
  canAttemptJob,
  canTransitionRuntimeJob,
  serializeRuntimeError,
} from "../lib/runtime/job-policy.ts";
import { sanitizeRuntimeValue } from "../lib/runtime-logging.ts";
import { listProducts } from "../services/products.service.ts";
import {
  isExpectedReadUnavailableError,
  resolveReadErrorResponse,
  unavailableCoupangDashboardResponse,
  unavailableListResponse,
} from "../lib/api-responses.ts";
import { classifyNetworkError, findNetworkErrorCode } from "../lib/network-errors.ts";
import {
  COUPANG_SELLER_JOBS_SELECT,
  DISCOVERY_BUNDLES_SELECT,
  DISCOVERY_RECOMMENDATIONS_SELECT,
} from "../lib/supabase-selects.ts";

test("Supabase availability rejects missing and malformed configuration", () => {
  assert.deepEqual(getSupabaseAvailability({}), {
    status: "unconfigured",
    reason: "missing_url",
  });
  assert.deepEqual(getSupabaseAvailability({
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
  }), { status: "invalid", reason: "malformed_url" });
});

test("Supabase availability accepts a valid HTTPS configuration", () => {
  assert.equal(getSupabaseAvailability({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  }).status, "configured");
});

test("Supabase availability rejects committed example placeholders", () => {
  const availability = getSupabaseAvailability({
    NEXT_PUBLIC_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  });
  assert.deepEqual(availability, { status: "invalid", reason: "placeholder_configuration" });
  if (availability.status !== "invalid") assert.fail("Expected invalid configuration");
  assert.equal(new SupabaseUnavailableError(availability).message, "Supabase is invalid");
});

test("products return the documented fallback when Supabase is absent", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    assert.deepEqual(await listProducts({
      keyword: "", recommendation: "", reviewStatus: "", favoriteOnly: false,
      minimumScore: 0, sort: "score", start: 0, end: 19,
    }), { products: [], totalCount: 0, available: false });
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("list fallbacks preserve endpoint fields and the standard data envelope", () => {
  assert.deepEqual(unavailableListResponse("recommendations"), {
    success: true,
    available: false,
    data: [],
    recommendations: [],
    message: "No data available",
  });
});

test("expected read unavailability is limited to configuration, network, and missing schema", () => {
  assert.equal(isExpectedReadUnavailableError({ code: "PGRST205" }), true);
  assert.equal(isExpectedReadUnavailableError({ code: "PGRST201" }), true);
  assert.equal(isExpectedReadUnavailableError({ code: "42703" }), true);
  assert.equal(isExpectedReadUnavailableError(new TypeError("fetch failed")), true);
  assert.equal(isExpectedReadUnavailableError(new Error("unexpected application bug")), false);
});

test("expected schema and network read errors resolve to 200 with empty endpoint data", () => {
  for (const error of [
    { code: "42P01", message: "relation does not exist" },
    { code: "42703", message: "column does not exist" },
    { code: "PGRST200", message: "relationship missing from schema cache" },
    Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }),
  ]) {
    assert.deepEqual(
      resolveReadErrorResponse(
        error,
        unavailableCoupangDashboardResponse(),
        "failed",
      ),
      {
        status: 200,
        body: {
          success: true,
          available: false,
          jobs: [],
          drafts: [],
          attempts: [],
          message: "No data available",
        },
      },
    );
  }
});

test("unexpected read errors resolve to 500", () => {
  assert.deepEqual(
    resolveReadErrorResponse(
      new Error("unexpected application bug"),
      unavailableListResponse("recommendations"),
      "failed",
    ),
    {
      status: 500,
      body: { success: false, message: "failed" },
    },
  );
});

test("discovery selects query product_url while preserving the url response key", () => {
  assert.match(
    DISCOVERY_RECOMMENDATIONS_SELECT,
    /market_products\([^)]*url:product_url\)/,
  );
  assert.match(
    DISCOVERY_BUNDLES_SELECT,
    /market_products\([^)]*url:product_url\)/,
  );
  assert.doesNotMatch(DISCOVERY_RECOMMENDATIONS_SELECT, /[,()]url[,)]/);
  assert.doesNotMatch(DISCOVERY_BUNDLES_SELECT, /[,()]url[,)]/);
});

test("Coupang jobs select disambiguates the workflow_id relationship", () => {
  assert.match(
    COUPANG_SELLER_JOBS_SELECT,
    /commerce_workflows!workflow_id\(workflow_code, workflow_name, current_stage\)/,
  );
});

test("runtime job policy bounds retries and prevents duplicate running claims", () => {
  assert.equal(boundedMaxAttempts(99), 10);
  assert.equal(canAttemptJob(2, 3), true);
  assert.equal(canAttemptJob(3, 3), false);
  assert.equal(canTransitionRuntimeJob("queued", "running"), true);
  assert.equal(canTransitionRuntimeJob("running", "running"), false);
  assert.equal(canTransitionRuntimeJob("completed", "running"), false);
});

test("runtime error and structured values redact sensitive data", () => {
  assert.equal(
    serializeRuntimeError(new Error("token=abc123 request failed")),
    "token=[redacted] request failed",
  );
  assert.deepEqual(sanitizeRuntimeValue({
    authorization: "Bearer secret",
    nested: { apiKey: "secret", message: "safe" },
  }), {
    authorization: "[redacted]",
    nested: { apiKey: "[redacted]", message: "safe" },
  });
});

test("nested fetch causes retain a safe network failure classification", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("connect timed out"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
  });
  assert.equal(findNetworkErrorCode(error), "UND_ERR_CONNECT_TIMEOUT");
  assert.equal(classifyNetworkError(error), "connection_timeout");
});
