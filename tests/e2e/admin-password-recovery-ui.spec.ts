import { expect, test } from "@playwright/test";

test("administrator recovery exposes a prefetch-safe code entry", async ({
  page,
}) => {
  await page.goto("/admin/login");

  const recovery = page.getByRole("region", {
    name: "Reset administrator password",
  });
  await expect(
    recovery.getByRole("button", { name: "Send recovery code" }),
  ).toBeVisible();
  await expect(
    recovery.getByRole("textbox", { name: "Recovery code" }),
  ).toHaveAttribute("inputmode", "numeric");
  await expect(
    recovery.getByRole("button", { name: "Verify recovery code" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ConfirmationURL");
});
