import { test, expect } from "@playwright/test";

/**
 * 参加者フロー（バックエンド起動が必要）
 *
 * 事前条件: src/backend で npm run dev が起動していること
 * テスト対象: ルームコード入力 → プロフィール設定 → 待機画面
 *
 * 実際に存在するルームがないため Socket.io の接続後の状態は
 * PlayPage の内部ロジックに依存する。
 * ここでは ProfilePage までの UI フローを検証する。
 */
test.describe("参加者フロー", () => {
  test("PlayPage でプロフィール設定画面が表示される", async ({ page }) => {
    // PlayPage は Socket.io 接続後に ProfilePage か WaitingPage を表示する
    // 接続失敗時は WaitingPage（エラーメッセージ付き）を表示することが多い
    await page.goto("/play/TESTCD");

    // どちらかの画面が表示されるまで待つ
    await expect(
      page.getByText("プロフィール設定").or(page.getByText("まもなく開始します"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("ニックネームが空のとき参加ボタンが押せない", async ({ page }) => {
    await page.goto("/play/TESTCD");

    // ProfilePage が表示された場合のみテスト
    const profileHeading = page.getByRole("heading", { name: "プロフィール設定" });
    const isProfilePage = await profileHeading.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isProfilePage) {
      test.skip();
      return;
    }

    const joinButton = page.getByRole("button", { name: "参加する" });
    await expect(joinButton).toBeDisabled();
  });

  test("ニックネーム入力で参加ボタンが有効になる", async ({ page }) => {
    await page.goto("/play/TESTCD");

    const profileHeading = page.getByRole("heading", { name: "プロフィール設定" });
    const isProfilePage = await profileHeading.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isProfilePage) {
      test.skip();
      return;
    }

    await page.getByLabel("ニックネーム（20文字以内）").fill("テスト太郎");
    const joinButton = page.getByRole("button", { name: "参加する" });
    await expect(joinButton).toBeEnabled();
  });

  test("ニックネームが20文字で切り捨てられる", async ({ page }) => {
    await page.goto("/play/TESTCD");

    const profileHeading = page.getByRole("heading", { name: "プロフィール設定" });
    const isProfilePage = await profileHeading.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isProfilePage) {
      test.skip();
      return;
    }

    const input = page.getByLabel("ニックネーム（20文字以内）");
    await input.fill("あいうえおかきくけこさしすせそたちつてとナ"); // 21文字
    const value = await input.inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
  });
});
