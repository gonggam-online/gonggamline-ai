import { expect, test } from "@playwright/test";

test("engine 1 recommends market keywords and hands the selected term to engine 2", async ({ page }) => {
  await page.route("**/api/market/discovery-dashboard", (route) => route.fulfill({ json: { success: true, dashboard: {
    finder: { completedAt: "2026-08-26T00:00:00Z", summary: { trackedKeywords: 2, actionableCount: 1, providerCount: 2 }, keywordProfiles: [{ keyword: "틈새수납", state: "RISING", score: 91, confidence: 80, demand: 82, momentum: 14, shoppingIntent: 84, competitionHeadroom: 66, providers: ["naver", "youtube"] }], contentFeed: [], providerCoverage: ["naver", "youtube"], collectorHealth: [] },
    portfolio: [{ id: "trend:test", source: "MARKET_TREND", title: "틈새수납 세트", concept: "틈새수납", form: "set", priorityScore: 83, marketScore: 91, growthScore: 82, profitScore: 58, scaleScore: 86, readinessScore: 76, riskScore: 31, confidence: 80, lane: "SCALE_READY", estimatedUnitsLow: null, estimatedUnitsHigh: null, reasons: ["복수 신호 상승"], unresolved: [], thumbnailUrl: null, recommendationId: null }],
  } } }));
  await page.route("**/api/admin/item-selection/runs?**", (route) => route.fulfill({ json: { data: [], page: { nextCursor: null } } }));

  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "틈새수납 세트" })).toBeVisible();
  const handoff = page.getByRole("link", { name: /경쟁력·수익성 검증/ });
  await expect(handoff).toHaveAttribute("href", "/admin/item-selection?keyword=%ED%8B%88%EC%83%88%EC%88%98%EB%82%A9");
  await handoff.click();
  await expect(page).toHaveURL(/\/admin\/item-selection\?keyword=/);
  await expect(page.getByLabel("검색어")).toHaveValue("틈새수납");
  await expect(page.getByRole("heading", { name: "2. 상품선정·수익성" })).toBeVisible();
});
