import { expect, test } from "@playwright/test";

const enabled = process.env.ITEM_SELECTION_SECURITY_PREVIEW_SMOKE === "1";

test.skip(!enabled, "Requires the authenticated Supabase Preview boundary.");

test("R1 Product mutation routes fail closed before database or provider work", async ({
  request,
}) => {
  const cases = [
    { method: "post", route: "/api/admin/products/import" },
    { method: "patch", route: "/api/products/1" },
    { method: "post", route: "/api/products/1/competition" },
    { method: "post", route: "/api/products/1/competition/auto" },
    { method: "post", route: "/api/competition/analyze-batch" },
  ] as const;
  for (const item of cases) {
    const response = await request[item.method](item.route, {
      data: {}, headers: { "content-type": "application/json" },
    });
    expect(response.status(), item.route).toBe(401);
    expect(await response.json()).toEqual({ code: "AUTHENTICATION_REQUIRED" });
  }
});
