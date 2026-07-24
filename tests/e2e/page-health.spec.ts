import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { pageRoutes } from "./routes";

const forbiddenText = /TypeError|fetch failed|Internal Server Error|Application error|Unexpected error|at\s+\S+\s+\([^)]*:\d+:\d+\)/i;

function monitor(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/")) {
      errors.push(`api ${response.status()}: ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "";
    if (errorText === "net::ERR_ABORTED") return;
    errors.push(`requestfailed: ${request.url()} ${errorText}`);
  });
  return errors;
}

for (const route of pageRoutes) {
  test(`${route} renders without browser failures`, async ({ page }, testInfo: TestInfo) => {
    const errors = monitor(page);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${route}`).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator("main, [role=main], h1").first()).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(page.locator("body")).not.toContainText(forbiddenText);
    await page.screenshot({ path: testInfo.outputPath(`route-${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}.png`), fullPage: true });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
