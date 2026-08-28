import { expect, test } from "@playwright/test";

test("engine 1 recommends market keywords and hands the selected term to engine 2", async ({ page }) => {
  await page.route("**/api/market/discovery-dashboard", (route) => route.fulfill({ json: { success: true, dashboard: {
    finder: { completedAt: "2026-08-26T00:00:00Z", summary: { trackedKeywords: 2, actionableCount: 1, providerCount: 2 }, keywordProfiles: [{ keyword: "틈새수납", state: "RISING", score: 91, confidence: 80, demand: 82, momentum: 14, shoppingIntent: 84, competitionHeadroom: 66, providers: ["naver", "youtube"] }], contentFeed: [], providerCoverage: ["naver", "youtube"], collectorHealth: [], skuRankings: [{ rank: 1, skuKey: "legacy:1", title: "이전 계약 후보", source: "legacy", sourceUrl: null, coupangMatch: "NO_MATCH", score: 50, confidence: 40, concept: "틈새수납", priceKrw: 10000, supplierQuoteFresh: false, skuLogisticsCostKrw: null, estimatedProfitKrw: null, relevantTikTokSignals: 0, ignoredTikTokSignals: 0, missingEvidence: [], reasons: [] }], skuRecommendations: [{ rank: 1, skuKey: "coupang:123", title: "슬림 틈새 수납장", source: "coupang_public", sourceUrl: "https://www.coupang.com/vp/products/123", coupangMatch: "COUPANG_EXACT", score: 82, confidence: 72, concept: "틈새수납", priceKrw: 18900, reviewCount: 42, availability: "IN_STOCK", estimatedMonthlyUnits: 180, estimatedMonthlyRevenueKrw: 3402000, supplierQuoteFresh: true, supplierUnitCostKrw: 6200, supplierInboundCostKrw: 300, inspectionPackagingCostKrw: 200, threePlCostKrw: 1100, skuLogisticsCostKrw: 1600, landedUnitCostKrw: 7800, coupangFeeKrw: 2041, returnAllowanceKrw: 250, estimatedProfitKrw: 8809, estimatedMarginRate: 46.6, profitabilityStatus: "VERIFIED_QUOTE", relevantTikTokSignals: 1, ignoredTikTokSignals: 0, missingEvidence: [], reasons: [], qualification: "SELL_READY", identityProviders: ["coupang_public", "naver_official"] }], skuVerificationQueue: [], skuRankingAudit: { recommendationProducts: 1 }, skuDiscoveryLoop: {} },
    portfolio: [{ id: "trend:test", source: "MARKET_TREND", title: "틈새수납 세트", concept: "틈새수납", form: "set", priorityScore: 83, marketScore: 91, growthScore: 82, profitScore: 58, scaleScore: 86, readinessScore: 76, riskScore: 31, confidence: 80, lane: "SCALE_READY", estimatedUnitsLow: null, estimatedUnitsHigh: null, reasons: ["복수 신호 상승"], unresolved: [], thumbnailUrl: null, recommendationId: null }],
  } } }));
  await page.route("**/api/admin/item-selection/runs?**", (route) => route.fulfill({ json: { data: [], page: { nextCursor: null } } }));

  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "틈새수납 세트" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "최신 추천상품과 기본 수익성" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "슬림 틈새 수납장" })).toBeVisible();
  await expect(page.getByText("예상 단위 순이익")).toBeVisible();
  await expect(page.getByText("이전 계약 후보")).toHaveCount(0);
  const handoff = page.getByRole("link", { name: /경쟁력·수익성 검증/ });
  await expect(handoff).toHaveAttribute("href", "/admin/item-selection?keyword=%ED%8B%88%EC%83%88%EC%88%98%EB%82%A9");
  await handoff.click();
  await expect(page).toHaveURL(/\/admin\/item-selection\?keyword=/);
  await expect(page.getByLabel("검색어")).toHaveValue("틈새수납");
  await expect(page.getByRole("heading", { name: "2. 상품선정·수익성" })).toBeVisible();
});
