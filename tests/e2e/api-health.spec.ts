import { expect, test } from "@playwright/test";

test("runtime health is operational", async ({ request }) => {
  const response = await request.get("/api/health/runtime");
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({ success: true, checks: { application: "ok" } });
  expect(JSON.stringify(body)).not.toMatch(/stack|password|secret|token/i);
});

test("products API returns a safe array", async ({ request }) => {
  const response = await request.get("/api/products");
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toMatchObject({ success: true, products: expect.any(Array) });
  expect(JSON.stringify(body)).not.toMatch(/stack|password|secret|token/i);
});
