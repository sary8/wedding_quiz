import { test, expect, Browser } from "@playwright/test";

/**
 * マルチプレイヤーフロー（バックエンド起動が必要）
 *
 * 事前条件:
 *   - src/backend で npm run dev 起動中
 *   - src/frontend で npm run dev 起動中（または webServer で自動起動）
 *
 * テストシナリオ:
 *   1. ホストがクイズを作成して部屋を開く
 *   2. 参加者が部屋に入る
 *   3. ホストがゲームを開始する
 *   4. 参加者が回答する
 */
test.describe("マルチプレイヤーフロー @integration", () => {
  test("ホストがクイズを作成できる", async ({ page }) => {
    await page.goto("/host/setup");

    // SetupPage のタイトルが表示される
    await expect(page.getByRole("heading", { name: "クイズ設定" })).toBeVisible({ timeout: 5000 });

    // クイズタイトル入力
    const titleInput = page.getByLabel("クイズタイトル");
    await titleInput.fill("E2Eテスト用クイズ");
    await expect(titleInput).toHaveValue("E2Eテスト用クイズ");
  });

  test("ホスト＋参加者の同時接続フロー", async ({ browser }: { browser: Browser }) => {
    // ホストブラウザ（デスクトップ）
    const hostContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const hostPage = await hostContext.newPage();

    // 参加者ブラウザ（モバイル）
    const participantContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
    });
    const participantPage = await participantContext.newPage();

    try {
      // 1. ホストがSetupPageを開く
      await hostPage.goto("/host/setup");
      await expect(
        hostPage.getByRole("heading", { name: "クイズ設定" })
      ).toBeVisible({ timeout: 8000 });

      // 2. 参加者がJoinPageを開く
      await participantPage.goto("/play");
      await expect(
        participantPage.getByRole("heading", { name: "Wedding Quiz" })
      ).toBeVisible({ timeout: 8000 });

      // 両方の画面が表示されていることを確認
      await expect(hostPage.getByRole("heading", { name: "クイズ設定" })).toBeVisible();
      await expect(participantPage.getByRole("heading", { name: "Wedding Quiz" })).toBeVisible();
    } finally {
      await hostContext.close();
      await participantContext.close();
    }
  });
});
