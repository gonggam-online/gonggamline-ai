import { expect, test } from "@playwright/test";

test("owner adapter export page exposes a bounded packet handoff", async ({ page }) => {
  await page.goto("/admin/listing/creative-adapter");
  await expect(page.getByRole("heading", { name: "External adapter packet Export" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Owner external adapter packet JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "검증하고 Export 준비" })).toBeDisabled();
  await expect(page.getByText("서버에는 packet을 저장하지 않습니다.")).toBeVisible();
});
