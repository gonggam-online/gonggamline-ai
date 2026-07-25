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
    const keyword = url.searchParams.get("keyword")?.toLowerCase() ?? "";
    const recommended = recommendation
      ? items.filter((item) => item.recommendationLevel === recommendation)
      : items;
    const filtered = keyword
      ? recommended.filter((item) => item.productName.toLowerCase().includes(keyword))
      : recommended;
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
  await expect(page).toHaveURL(/offset=20/);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Revenue Product 21");

  await page.getByLabel("Recommendation Level Filter").selectOption("STRONG_RECOMMEND");
  await expect(page).toHaveURL(/recommendationLevel=STRONG_RECOMMEND/);
  await expect(page).toHaveURL(/offset=0/);
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Revenue Product 3");

  await page.getByRole("button", { name: "Refresh revenue dashboard" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("search and filter state survives a shared URL reload", async ({ page }) => {
  await page.goto("/dashboard/revenue?keyword=Product+2&status=ready&minRevenueScore=70&offset=0");
  await expect(page.getByLabel("Search products by name")).toHaveValue("Product 2");
  await expect(page.getByLabel("Status Filter")).toHaveValue("ready");
  await expect(page.getByLabel("Minimum Revenue Score")).toHaveValue("70");
  await expect(page.getByRole("table")).toContainText("Revenue Product 2");

  await page.getByLabel("Search products by name").fill("Product 21");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/keyword=Product\+21/);
  await expect(page).toHaveURL(/status=ready/);
  await expect(page.getByRole("table")).toContainText("Revenue Product 21");

  await page.reload();
  await expect(page.getByLabel("Search products by name")).toHaveValue("Product 21");
  await expect(page.getByLabel("Status Filter")).toHaveValue("ready");

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).not.toHaveURL(/keyword=/);
  await expect(page.getByLabel("Search products by name")).toHaveValue("");
});
