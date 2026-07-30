import { expect, test } from "@playwright/test";

const enabled = process.env.ITEM_SELECTION_SECURITY_PREVIEW_SMOKE === "1";

test.describe("A01-A12 Preview security smoke", () => {
  test.skip(!enabled, "Requires an explicitly provisioned disposable Preview fixture.");

  test("login surface is stable and unauthenticated protected access fails closed", async ({
    page,
    request,
  }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading")).toBeVisible();

    const runId = "00000000-0000-4000-8000-000000000001";
    const response = await request.get(`/api/admin/item-selection/runs/${runId}`);
    expect(response.status()).toBe(401);
  });
});
