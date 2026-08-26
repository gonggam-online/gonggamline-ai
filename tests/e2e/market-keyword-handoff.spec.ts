import { expect, test } from "@playwright/test";

test("engine 1 recommends market keywords and hands the selected term to engine 2", async ({ page }) => {
  await page.route("**/api/market/summary", (route) => route.fulfill({ json: { success: true, summary: { keywordCount: 2, productCount: 0, snapshots24h: 0, alerts: [] } } }));
  await page.route("**/api/market/keywords", (route) => route.fulfill({ json: { success: true, keywords: [
    { id: 1, keyword: "틈새수납", category: "생활", priority: 80, collection_status: "active", collection_interval_minutes: 720, last_collected_at: null, next_collection_at: null, result_count: 10, demand_score: 82, competition_score: 56, opportunity_score: 91 },
    { id: 2, keyword: "낮은기회", category: "생활", priority: 70, collection_status: "active", collection_interval_minutes: 720, last_collected_at: null, next_collection_at: null, result_count: 10, demand_score: 70, competition_score: 60, opportunity_score: 72 },
  ] } }));
  await page.route("**/api/market/products?**", (route) => route.fulfill({ json: { success: true, products: [] } }));
  await page.route("**/api/market/collectors", (route) => route.fulfill({ json: { success: true, collectors: [], jobs: [] } }));
  await page.route("**/api/market/warehouse", (route) => route.fulfill({ json: { success: true, warehouse: { featureSnapshots: 0, feedbackEvents: 0, gradeCounts: {}, top: [] } } }));
  await page.route("**/api/admin/item-selection/runs?**", (route) => route.fulfill({ json: { data: [], page: { nextCursor: null } } }));

  await page.goto("/market");
  const recommendations = page.getByRole("region", { name: "시장 데이터 기반 추천 검색어" });
  await expect(recommendations.getByRole("link", { name: /틈새수납/ })).toHaveAttribute("href", "/admin/item-selection?keyword=%ED%8B%88%EC%83%88%EC%88%98%EB%82%A9");
  await recommendations.getByRole("link", { name: /틈새수납/ }).click();
  await expect(page).toHaveURL(/\/admin\/item-selection\?keyword=/);
  await expect(page.getByLabel("검색어")).toHaveValue("틈새수납");
  await expect(page.getByRole("heading", { name: "2. 상품선정·수익성" })).toBeVisible();
});
