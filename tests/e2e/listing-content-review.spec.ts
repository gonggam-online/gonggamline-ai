import { expect, test, type Page, type TestInfo } from "@playwright/test";

function monitor(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console.error: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`response ${response.status()}: ${response.url()}`); });
  page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`));
  return errors;
}

test("listing review keeps registration and conversion gates readable on mobile", async ({ page }, testInfo: TestInfo) => {
  const errors = monitor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/listing/review", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "증거 기반 Listing 검토" })).toBeVisible();
  await expect(page.getByText("Registration readiness")).toBeVisible();
  await expect(page.getByText("Conversion readiness")).toBeVisible();
  await expect(page.getByText(/BLOCKER \/ WARNING \/ OPTIMIZATION_PENDING/)).toBeVisible();
  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("listing-review-mobile.png"), fullPage: true });
  expect(errors, errors.join("\n")).toEqual([]);
});
