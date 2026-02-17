import { test, expect } from "@playwright/test";

test.describe("404ページ", () => {
  test("存在しないURLで404ページが表示される", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("お探しのページは見つかりませんでした")).toBeVisible();
  });

  test("トップへ戻るボタンで/playに戻る", async ({ page }) => {
    await page.goto("/some/random/path");
    await page.getByRole("button", { name: "トップへ戻る" }).click();
    await expect(page).toHaveURL("/play");
  });

  test("ネストした存在しないURLでも404が表示される", async ({ page }) => {
    await page.goto("/host/nonexistent/deep/path");
    await expect(page.getByText("404")).toBeVisible();
  });
});
