import { expect, test } from "@playwright/test";

test("owner adapter export page exposes a bounded packet handoff", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter");
  await expect(page.getByRole("heading", { name: "External adapter packet Export" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Owner external adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "검증하고 Export 준비" })).toBeDisabled();
  await expect(page.getByText("서버에는 packet을 저장하지 않습니다.")).toBeVisible();
});

test("owner adapter re-prepare page exposes a fresh revision workflow", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter/reprepare");
  await expect(page.getByRole("heading", { name: "새 external adapter packet revision" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New WING adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "새 revision 생성·검증" })).toBeDisabled();
  await expect(page.getByText("이전 JSON export를 찾지 않고")).toBeVisible();
});
