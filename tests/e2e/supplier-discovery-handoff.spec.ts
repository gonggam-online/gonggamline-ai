import { expect, test } from "@playwright/test";

test("selected item handoff automatically shows ranked public supplier candidates", async ({ page }) => {
  await page.route("**/api/sourcing/suppliers", (route) => route.fulfill({ json: {
    success: true,
    suppliers: [], quotes: [],
    singles: [{ id: 7, status: "approved", ai_score: 88, market_products: { title: "KK946 미니 파우치", category: "수납", brand: null } }],
    bundles: [],
  } }));
  await page.route("**/api/admin/auth/csrf?purpose=supplier-public-discovery", (route) => route.fulfill({ json: { token: "supplier-fixture-token" } }));
  await page.route("**/api/sourcing/public-candidates", async (route) => {
    expect(route.request().headers()["x-gonggamline-csrf"]).toBe("supplier-fixture-token");
    expect(route.request().postDataJSON()).toEqual({ keyword: "KK946 미니 파우치" });
    await route.fulfill({ json: { success: true, data: {
      version: "gonggamline-public-supplier-candidate-discovery-v1",
      keyword: "KK946 미니 파우치",
      candidates: [{ supplier: "domeggook", supplierName: "도매꾹", supplierPriority: 2, title: "KK946 미니 파우치 블랙", productUrl: "https://domeggook.com/main/item/itemView.php?no=56288849", providerItemId: "56288849", publicPriceKrw: 8_100, stockStatus: "IN_STOCK", matchLevel: "STRONG_CANDIDATE", matchScore: 95, matchReasons: ["모델 식별자 일치"], missingInformation: ["옵션별 재고", "배송비"], saleReadiness: "REQUIRES_LOGIN_CONFIRMATION", observedAt: "2026-08-27T00:00:00.000Z" }],
      suppliers: [], requestCount: 1, estimatedCostUsd: 0.002, collectedAt: "2026-08-27T00:00:00.000Z", outputDigest: "a".repeat(64),
    } } });
  });

  await page.goto("/sourcing?keyword=KK946%20%EB%AF%B8%EB%8B%88%20%ED%8C%8C%EC%9A%B0%EC%B9%98");
  await expect(page.getByRole("heading", { name: "선정 상품의 공급처 자동 탐색" })).toBeVisible();
  await expect(page.getByText("KK946 미니 파우치 블랙")).toBeVisible();
  await expect(page.getByText("95점")).toBeVisible();
  await expect(page.getByRole("link", { name: "공급처 판매 페이지 확인" })).toHaveAttribute("href", /domeggook\.com/);
});
