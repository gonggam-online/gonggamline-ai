import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createDomeggookHealthHandler } from "../app/api/integrations/domeggook/health/route";
import { DomeggookError } from "../lib/domeggook/errors";
import { DomeggookHealthService } from "../services/domeggook-health.service";
import type { SupplierCatalogPort } from "../shared/domain/supplier-catalog";

function fakeCatalog(
  search: SupplierCatalogPort["searchItems"]
): SupplierCatalogPort {
  return {
    getItem: async () => ({ status: "not_found", item: null }),
    searchItems: search,
  };
}

test("default health is network-free and reports missing configuration", () => {
  let calls = 0;
  const service = new DomeggookHealthService({
    isConfigured: () => false,
    now: () => 0,
    catalog: fakeCatalog(async () => {
      calls += 1;
      return {
        provider: "domeggook",
        items: [],
        pagination: {
          page: 1,
          size: 1,
          totalItems: 0,
          hasNextPage: false,
        },
      };
    }),
  });
  assert.deepEqual(service.checkConfiguration(), {
    ok: false,
    provider: "domeggook",
    configuration: "missing",
    authentication: "cannot_verify",
    reachable: "cannot_verify",
    errorCode: "CONFIGURATION_MISSING",
    checkedAt: "1970-01-01T00:00:00.000Z",
  });
  assert.equal(calls, 0);
});

test("configured default health does not claim authentication", () => {
  const service = new DomeggookHealthService({
    isConfigured: () => true,
    now: () => 0,
    catalog: fakeCatalog(async () => {
      throw new Error("must not run");
    }),
  });
  const result = service.checkConfiguration();
  assert.equal(result.ok, true);
  assert.equal(result.configuration, "configured");
  assert.equal(result.authentication, "cannot_verify");
  assert.equal(result.reachable, "cannot_verify");
});

test("provider verification performs one size-one read-only probe", async () => {
  const inputs: unknown[][] = [];
  const service = new DomeggookHealthService({
    isConfigured: () => true,
    now: () => 0,
    probeKeyword: "생활",
    catalog: fakeCatalog(async (...input) => {
      inputs.push(input);
      return {
        provider: "domeggook",
        items: [],
        pagination: {
          page: 1,
          size: 1,
          totalItems: 0,
          hasNextPage: false,
        },
      };
    }),
  });
  const result = await service.verifyProvider();
  assert.equal(result.ok, true);
  assert.equal(result.authentication, "authenticated");
  assert.equal(result.reachable, "reachable");
  assert.deepEqual(inputs, [["생활", 1, 1]]);
});

test("provider verification is cached for sixty seconds", async () => {
  let currentTime = 0;
  let calls = 0;
  const service = new DomeggookHealthService({
    isConfigured: () => true,
    now: () => currentTime,
    catalog: fakeCatalog(async () => {
      calls += 1;
      return {
        provider: "domeggook",
        items: [],
        pagination: {
          page: 1,
          size: 1,
          totalItems: 0,
          hasNextPage: false,
        },
      };
    }),
  });
  await service.verifyProvider();
  currentTime = 59_999;
  await service.verifyProvider();
  assert.equal(calls, 1);
  currentTime = 60_001;
  await service.verifyProvider();
  assert.equal(calls, 2);
});

test("concurrent provider health verification shares one probe", async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = new DomeggookHealthService({
    isConfigured: () => true,
    catalog: fakeCatalog(async () => {
      calls += 1;
      await wait;
      return {
        provider: "domeggook",
        items: [],
        pagination: {
          page: 1,
          size: 1,
          totalItems: 0,
          hasNextPage: false,
        },
      };
    }),
  });
  const first = service.verifyProvider();
  const second = service.verifyProvider();
  release?.();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test("health classifies authentication, timeout, and provider failures", async () => {
  for (const [code, authentication, reachable] of [
    ["AUTHENTICATION_FAILED", "authentication_failed", "cannot_verify"],
    ["TIMEOUT", "cannot_verify", "unreachable"],
    ["PROVIDER_ERROR", "cannot_verify", "cannot_verify"],
  ] as const) {
    const service = new DomeggookHealthService({
      isConfigured: () => true,
      catalog: fakeCatalog(async () => {
        throw new DomeggookError(code);
      }),
    });
    const result = await service.verifyProvider();
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, code);
    assert.equal(result.authentication, authentication);
    assert.equal(result.reachable, reachable);
    assert.equal("secret" in result, false);
  }
});

test("health HTTP contract maps sanitized status and disables caching", async () => {
  const service = new DomeggookHealthService({
    isConfigured: () => false,
    now: () => 0,
    catalog: fakeCatalog(async () => {
      throw new Error("must not run");
    }),
  });
  const response = await createDomeggookHealthHandler(service)(
    new NextRequest("https://example.test/api/integrations/domeggook/health")
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    provider: "domeggook",
    configuration: "missing",
    authentication: "cannot_verify",
    reachable: "cannot_verify",
    errorCode: "CONFIGURATION_MISSING",
    checkedAt: "1970-01-01T00:00:00.000Z",
  });
});
