import { test, expect } from "@playwright/test";

test.describe("JoinPage（ルームコード入力）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play");
  });

  // ルームコード input を取得するヘルパー（placeholder で特定）
  const roomCodeInput = (page: import("@playwright/test").Page) =>
    page.getByPlaceholder("XXXXXX");

  test("/ にアクセスすると /play にリダイレクトされる", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/play");
  });

  test("Wedding Quiz のタイトルが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Wedding Quiz" })).toBeVisible();
  });

  test("初期状態で参加ボタンが無効", async ({ page }) => {
    const button = page.getByRole("button", { name: "参加する" });
    await expect(button).toBeDisabled();
  });

  test("6文字未満では参加ボタンが無効のまま", async ({ page }) => {
    await roomCodeInput(page).fill("ABC");
    const button = page.getByRole("button", { name: "参加する" });
    await expect(button).toBeDisabled();
  });

  test("6文字入力で参加ボタンが有効になる", async ({ page }) => {
    await roomCodeInput(page).fill("ABCDEF");
    const button = page.getByRole("button", { name: "参加する" });
    await expect(button).toBeEnabled();
  });

  test("小文字入力が自動で大文字に変換される", async ({ page }) => {
    const input = roomCodeInput(page);
    await input.fill("abcdef");
    await expect(input).toHaveValue("ABCDEF");
  });

  test("6文字を超える入力が切り捨てられる", async ({ page }) => {
    const input = roomCodeInput(page);
    await input.fill("ABCDEFGHI");
    await expect(input).toHaveValue("ABCDEF");
  });

  test("6文字入力してEnterで /play/:code に遷移", async ({ page }) => {
    await roomCodeInput(page).fill("TESTAB");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/play/TESTAB");
  });

  test("参加するボタンクリックで /play/:code に遷移", async ({ page }) => {
    await roomCodeInput(page).fill("XYZ123");
    await page.getByRole("button", { name: "参加する" }).click();
    await expect(page).toHaveURL("/play/XYZ123");
  });
});
