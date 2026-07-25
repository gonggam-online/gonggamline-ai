import { expect, test, type TestInfo } from "@playwright/test";

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

let dashboardRequests = 0;

test.beforeEach(async ({ page }) => {
  dashboardRequests = 0;
  await page.route("**/api/dashboard/revenue?**", async (route) => {
    dashboardRequests += 1;
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
  await expect(page.getByText("Data generated")).toBeVisible();
  await expect(page.getByText("Last refreshed")).toBeVisible();
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
  await expect(page.getByLabel("Active filters")).toContainText("3 active");
  await expect(page.getByLabel("Active filters")).toContainText("Search: Product 21");

  await page.reload();
  await expect(page.getByLabel("Search products by name")).toHaveValue("Product 21");
  await expect(page.getByLabel("Status Filter")).toHaveValue("ready");

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).not.toHaveURL(/keyword=/);
  await expect(page.getByLabel("Search products by name")).toHaveValue("");

  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(page.getByLabel("Active filters")).toContainText("No active filters");
  await expect(page.getByLabel("Status Filter")).toHaveValue("");
  await expect(page.getByLabel("Minimum Revenue Score")).toHaveValue("");
});

test("refresh suppresses duplicate clicks and retry recovers", async ({ page }) => {
  await page.goto("/dashboard/revenue");
  await expect(page.getByRole("table")).toBeVisible();
  expect(dashboardRequests).toBe(1);
  await page.getByRole("button", { name: "Refresh revenue dashboard" }).evaluate(
    (button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    },
  );
  await expect.poll(() => dashboardRequests).toBe(2);
  await expect(page.getByRole("button", { name: "Refresh revenue dashboard" })).toBeEnabled();

  await page.unroute("**/api/dashboard/revenue?**");
  let attempts = 0;
  await page.route("**/api/dashboard/revenue?**", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Temporary dashboard failure" } }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [],
        pagination: { limit: 20, offset: 0, total: 0, returned: 0, hasMore: false },
        filters: { recommendationLevel: null, status: null, minRevenueScore: null },
        meta: {
          generatedAt: "2026-07-25T03:00:00.000Z",
          engineVersion: null,
          rankingVersion: null,
          totalProducts: 0,
        },
      }),
    });
  });
  await page.reload();
  await expect(
    page.locator(".dashboard-foundation__state--error"),
  ).toContainText("Temporary dashboard failure");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No ranked products")).toBeVisible();
});

test("long operational content stays contained on mobile", async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/revenue");
  await expect(page.getByRole("heading", { name: "Revenue Dashboard" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("revenue-dashboard-mobile.png"),
    fullPage: true,
  });
});
