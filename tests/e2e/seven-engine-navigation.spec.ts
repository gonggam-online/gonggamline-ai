import { expect, test } from "@playwright/test";

test("shared navigation expands only the current engine and keeps one portal link", async ({ page }) => {
  await page.goto("/discovery", { waitUntil: "domcontentloaded" });

  const navigation = page.getByRole("navigation", { name: "7대 엔진 통합 메뉴" });
  await expect(navigation.getByRole("link", { name: /7대 엔진 통합 포털/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "1. 시장정보·아이템 발굴" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "2. 상품선정·수익성" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "7. 성과분석·학습" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /5-1\./ })).toHaveCount(0);
  await expect(page.locator('a[href="/dashboard"]')).toHaveCount(1);
  await expect(page.locator(".engine-shell")).toHaveAttribute("data-engine", "1");
});

test("engine theme and expanded subpages follow the current route on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/listing/review", { waitUntil: "domcontentloaded" });

  const shell = page.locator(".engine-shell");
  const navigation = page.getByRole("navigation", { name: "7대 엔진 통합 메뉴" });
  await expect(shell).toHaveAttribute("data-engine", "5");
  await expect(navigation.getByRole("link", { name: "5-1. 증거 기반 콘텐츠 검토" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "5-4. 이미지 생성·비공개 검토" })).toBeVisible();
  await expect(page.locator(".engine-navigation__engines>li.is-active")).toHaveCSS("background-color", "rgb(255, 220, 235)");
  await expect(shell).toHaveCSS("background-color", "rgb(255, 241, 247)");
});
