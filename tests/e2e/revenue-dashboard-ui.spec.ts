import { expect, test } from "@playwright/test";

const items = Array.from({ length: 21 }, (_, index) => ({
  rank: index + 1,
  productId: `P-${index + 1}`,
  productName: `Revenue Product ${index + 1}`,
  rankingScore: 95 - index,
  revenueScore: 90 - index,
  recommendationLevel: index < 3 ? "STRONG_RECOMMEND" : "RECOMMEND",
  confidence: 88,
  reasonCodes: ["HIGH_MARGIN", "STRONG_DEMAND"],
  status: "ready",
  lastAnalyzedAt: "2026-07-25T03:00:00.000Z",
}));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/dashboard/revenue?**", async (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const recommendation = url.searchParams.get("recommendationLevel");
    const filtered = recommendation
      ? items.filter((item) => item.recommendationLevel === recommendation)
      : items;
    const pageItems = filtered.slice(offset, offset + 20);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: pageItems,
        pagination: {
          limit: 20,
          offset,
          total: filtered.length,
          returned: pageItems.length,
          hasMore: offset + pageItems.length < filtered.length,
        },
        filters: {
          recommendationLevel: recommendation,
          status: null,
          minRevenueScore: null,
        },
        meta: {
          generatedAt: "2026-07-25T03:00:00.000Z",
          engineVersion: null,
          rankingVersion: null,
          totalProducts: items.length,
        },
      }),
    });
  });
});

test("operator can inspect, filter, paginate, and refresh rankings", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/dashboard/revenue");
  await expect(page.getByRole("heading", { name: "Revenue Dashboard" })).toBeVisible();
  await expect(page.getByLabel("Revenue summary")).toContainText("21");
  await expect(page.getByRole("table")).toContainText("Revenue Product 1");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Revenue Product 21");

  await page.getByLabel("Recommendation Level Filter").selectOption("STRONG_RECOMMEND");
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Revenue Product 3");

  await page.getByRole("button", { name: "Refresh revenue dashboard" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(browserErrors).toEqual([]);
});
