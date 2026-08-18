import assert from "node:assert/strict";
import { test } from "node:test";

import { checkCoupangLogisticsPreflight } from "../engines/listing/coupang-logistics-preflight.ts";

const base = { COUPANG_ACCESS_KEY: process.env.COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY: process.env.COUPANG_SECRET_KEY, COUPANG_VENDOR_ID: process.env.COUPANG_VENDOR_ID };

function setSyntheticConfig(): void {
  process.env.COUPANG_ACCESS_KEY = "synthetic-access";
  process.env.COUPANG_SECRET_KEY = "synthetic-secret";
  process.env.COUPANG_VENDOR_ID = "synthetic-vendor";
}

function restoreConfig(): void {
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Coupang logistics preflight is READY only after a valid read-only contract", async () => {
  setSyntheticConfig();
  try {
    const result = await checkCoupangLogisticsPreflight(new Date("2026-08-18T00:00:00.000Z"), async (options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.path, "/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound");
      assert.equal(options.searchParams.get("pageSize"), "1");
      return { ok: true, status: 200, data: { content: [] }, raw: null };
    });
    assert.equal(result.status, "READY");
    assert.equal(result.readOnly, true);
    assert.equal(result.staticEgressRequired, true);
  } finally {
    restoreConfig();
  }
});

test("preflight distinguishes authentication/IP allowlist rejection from upstream failure", async () => {
  setSyntheticConfig();
  try {
    const rejected = await checkCoupangLogisticsPreflight(new Date(), async () => ({ ok: false, status: 403, data: null, raw: null }));
    const unavailable = await checkCoupangLogisticsPreflight(new Date(), async () => ({ ok: false, status: 502, data: null, raw: null }));
    assert.equal(rejected.status, "AUTHENTICATION_OR_IP_ALLOWLIST");
    assert.equal(unavailable.status, "PROVIDER_UNAVAILABLE");
  } finally {
    restoreConfig();
  }
});

test("preflight reports missing credentials without network access", async () => {
  delete process.env.COUPANG_ACCESS_KEY;
  delete process.env.COUPANG_SECRET_KEY;
  delete process.env.COUPANG_VENDOR_ID;
  const result = await checkCoupangLogisticsPreflight(new Date(), async () => {
    throw new Error("network must not be called");
  });
  assert.equal(result.status, "CONFIGURATION_MISSING");
  restoreConfig();
});
