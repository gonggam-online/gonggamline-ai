import { expect, test } from "@playwright/test";

test("owner adapter export page exposes a bounded packet handoff", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter");
  await expect(page.getByRole("heading", { name: "5-2. 외부 제작 Packet 내보내기" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Owner external adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/ })).toBeDisabled();
  await expect(page.getByText(/전체 export에는 배송지 코드·연락처·주소/)).toBeVisible();
  await expect(page.locator("main").getByText(/packet/).first()).toBeVisible();
});

test("owner adapter re-prepare page exposes a fresh revision workflow", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter/reprepare");
  await expect(page.getByRole("heading", { name: "5-3. 외부 제작 Packet 재준비" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New WING adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "revision 생성·검증" })).toBeDisabled();
  await expect(page.getByText("현재 WING에서 확인한 packet을 새 revision으로 묶습니다.")).toBeVisible();
});
