import { expect, test } from "@playwright/test";

test("creative operator exposes private review handoff recovery", async ({ page }) => {
  await page.goto("/admin/listing/creative-dispatch");
  await expect(page.getByRole("heading", { name: "전환 이미지 생성·비공개 검토" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "External adapter packet JSON" })).toBeVisible();
  const recovery = page.getByRole("textbox", { name: "Prepared plan reference for review recovery" });
  await expect(recovery).toBeVisible();
  await expect(page.getByRole("button", { name: "검토 handoff 다시 불러오기" })).toBeDisabled();
  await expect(page.getByText(/브라우저 응답을 잃었거나 signed URL이 만료된 경우/)).toBeVisible();
});
