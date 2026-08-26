import { expect, test } from "@playwright/test";
import { revenueCriticalRoutes } from "./routes";

for (const route of revenueCriticalRoutes) {
  test(`revenue-critical ${route} has meaningful content`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/raw JSON|stack trace|Internal Server Error/i);
  });
}

test("product filters remain safe", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const interactive = page.locator("select, input").first();
  if (await interactive.count()) await expect(interactive).toBeEnabled();
});

test("decision controls render without executing writes", async ({ page }) => {
  await page.goto("/discovery", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", {
    name: "1-1. 시장 후보 발굴·의사결정",
    exact: true,
  })).toBeVisible();
  await expect(page.getByRole("button", {
    name: "AI 의사결정 실행",
    exact: true,
  })).toBeVisible();
});
