import { expect, test } from "@playwright/test";

test("owner adapter export page exposes a bounded packet handoff", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter");
  await expect(page.getByRole("heading", { name: "External adapter packet Export" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Owner external adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/ })).toBeDisabled();
  await expect(page.locator("main").getByText(/packet/).first()).toBeVisible();
});

test("owner adapter re-prepare page exposes a fresh revision workflow", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter/reprepare");
  await expect(page.getByRole("heading", { name: "새 external adapter packet revision" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New WING adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "revision 생성·검증" })).toBeDisabled();
  await expect(page.getByText("현재 WING에서 확인한 packet을 새 revision으로 묶습니다.")).toBeVisible();
});
