import { expect, test } from "@playwright/test";

test("runtime health is operational", async ({ request }) => {
  const response = await request.get("/api/health/runtime");
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({ success: true, checks: { application: "ok" } });
  expect(JSON.stringify(body)).not.toMatch(/stack|password|secret|token/i);
});

test("Domeggook health is sanitized and network-free by default", async ({
  request,
}) => {
  const response = await request.get("/api/integrations/domeggook/health");
  expect([200, 503]).toContain(response.status());
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    ok: expect.any(Boolean),
    provider: "domeggook",
    configuration: expect.stringMatching(/^(configured|missing)$/),
    authentication: "cannot_verify",
    reachable: "cannot_verify",
    checkedAt: expect.any(String),
  });
  expect(JSON.stringify(body)).not.toMatch(
    /api[_-]?key|stack|password|secret|token|query/i,
  );
});

test("products API returns a safe array", async ({ request }) => {
  const response = await request.get("/api/products");
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({ success: true, products: expect.any(Array) });
  expect(JSON.stringify(body)).not.toMatch(/stack|password|secret|token/i);
});

test("revenue dashboard API returns a safe read-only response", async ({
  request,
}) => {
  const response = await request.get(
    "/api/dashboard/revenue?limit=5&offset=0&minRevenueScore=0",
  );
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    items: expect.any(Array),
    pagination: {
      limit: 5,
      offset: 0,
      total: expect.any(Number),
      returned: expect.any(Number),
      hasMore: expect.any(Boolean),
    },
    filters: {
      recommendationLevel: null,
      status: null,
      minRevenueScore: 0,
    },
    meta: {
      generatedAt: expect.any(String),
      totalProducts: expect.any(Number),
    },
  });
  expect(JSON.stringify(body)).not.toMatch(/stack|password|secret|token/i);
});

for (const query of [
  "",
  "?limit=5",
  "?offset=5",
  "?recommendationLevel=RECOMMEND",
  "?status=ready",
  "?minRevenueScore=70",
  "?keyword=Desk%20Lamp",
]) {
  test(`revenue dashboard contract accepts ${query || "defaults"}`, async ({
    request,
  }) => {
    const response = await request.get(`/api/dashboard/revenue${query}`);
    expect(response.status()).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      items: expect.any(Array),
      pagination: expect.any(Object),
      filters: expect.any(Object),
      meta: expect.any(Object),
    });
  });
}

test("revenue dashboard rejects an invalid limit", async ({ request }) => {
  const response = await request.get(
    "/api/dashboard/revenue?limit=invalid",
  );
  expect(response.status()).toBe(400);
  const body: unknown = await response.json();
  expect(body).toEqual({
    error: {
      code: "INVALID_QUERY_PARAMETER",
      message: "limit must be an integer from 1 to 100",
      details: { parameter: "limit" },
    },
  });
});
