import { expect, test, type Page, type TestInfo } from "@playwright/test";

function monitor(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console.error: ${message.text()}`); });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/api/")) errors.push(`api ${response.status()}: ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "";
    if (errorText !== "net::ERR_ABORTED") errors.push(`requestfailed: ${request.url()} ${errorText}`);
  });
  return errors;
}

test("listing review shows computed fixture artifacts and separate gates on mobile", async ({ page }, testInfo: TestInfo) => {
  const errors = monitor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/listing/review", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "5-1. 증거 기반 콘텐츠 검토" })).toBeVisible();
  await expect(page.getByText("Registration readiness")).toBeVisible();
  await expect(page.getByText("Conversion readiness")).toBeVisible();
  await expect(page.getByText(/BLOCKER \/ WARNING \/ OPTIMIZATION_PENDING/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "두 개의 creative 후보 미리보기" })).toBeVisible();
  await expect(page.locator(".status-badge", { hasText: "FIXTURE_PREVIEW" })).toBeVisible();
  await expect(page.locator("figcaption", { hasText: "FIXTURE_ONLY" })).toHaveCount(4);
  await expect(page.getByText(/computed QA/)).toHaveCount(4);
  await expect(page.getByText("human QA REVIEW_REQUIRED")).toHaveCount(4);
  await expect(page.getByText(/approval digest 없음/)).toBeVisible();
  await expect(page.locator("img")).toHaveCount(4);
  for (const image of await page.locator("img").all()) {
    await expect(image).toHaveJSProperty("complete", true);
    expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThanOrEqual(780);
  }
  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("listing-review-mobile.png"), fullPage: true });
  expect(errors, errors.join("\n")).toEqual([]);
});
