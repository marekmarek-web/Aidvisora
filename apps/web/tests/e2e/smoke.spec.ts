import { test, expect } from "@playwright/test";

test.describe("public smoke", () => {
  test("home responds", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok() || res?.status() === 307 || res?.status() === 308).toBeTruthy();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/prihlaseni");
    await expect(page.locator("body")).toBeVisible();
  });
});
