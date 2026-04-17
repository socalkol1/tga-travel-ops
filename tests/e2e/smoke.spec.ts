import { test, expect } from "@playwright/test";

test.describe("public shell", () => {
  test("renders landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("One operational hub")).toBeVisible();
  });
});
