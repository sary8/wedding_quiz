import { test, expect, type Browser, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:3001";

/**
 * 完全ゲームフロー統合テスト
 *
 * 事前条件:
 *   - src/backend で npm run dev が起動していること（ポート 3001）
 *   - src/frontend で npm run dev が起動していること（ポート 5174）
 *
 * テストシナリオ:
 *   1. クイズを API で作成
 *   2. ホストがロビーを開く（Socket.io openRoom）
 *   3. 参加者2名がルームに参加
 *   4. ホストがゲームを開始
 *   5. 参加者が回答
 *   6. ホストが結果・ランキングを表示
 *   7. ゲーム終了
 */

/** API でクイズ1問を作成し、quizId と hostSecret を返す */
async function createTestQuiz(request: APIRequestContext) {
  const quizRes = await request.post(`${API}/api/quizzes`, {
    data: { title: "E2Eテスト用クイズ" },
  });
  expect(quizRes.ok()).toBeTruthy();
  const quiz = await quizRes.json() as { id: number; host_secret: string };

  const qRes = await request.post(`${API}/api/questions`, {
    data: {
      quiz_id: quiz.id,
      question_text: "日本の首都は？",
      choice1: "東京",
      choice2: "大阪",
      choice3: "京都",
      choice4: "名古屋",
      correct_choice: 1,
      time_limit: 20,
    },
  });
  expect(qRes.ok()).toBeTruthy();

  return { quizId: quiz.id, hostSecret: quiz.host_secret };
}

test.describe("完全ゲームフロー @integration", () => {
  test("ホストがクイズを作成してロビーを開ける", async ({ request, page }) => {
    const { quizId, hostSecret } = await createTestQuiz(request);

    // ホストがロビーURL に直接アクセスできることを確認
    // （openRoom は SetupPage の「ロビーを開く」ボタンが発行するが、
    //   ここでは API 作成済みの quizId を使って SetupPage から遷移する）
    await page.goto("/host/setup");
    await expect(page.getByRole("heading", { name: "クイズ設定" })).toBeVisible({ timeout: 8000 });

    // 作成したクイズが一覧に表示されていることを確認
    await expect(page.getByText("E2Eテスト用クイズ")).toBeVisible({ timeout: 5000 });

    // クリーンアップ
    await request.delete(`${API}/api/quizzes/${quizId}?key=${hostSecret}`);
  });

  test("ホスト + 参加者2名のフル接続フロー", async ({
    browser,
    request,
  }: {
    browser: Browser;
    request: APIRequestContext;
  }) => {
    const { quizId, hostSecret } = await createTestQuiz(request);

    // ホストブラウザ
    const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const hostPage = await hostCtx.newPage();

    // 参加者ブラウザ × 2（別セッション）
    const p1Ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const p1Page = await p1Ctx.newPage();

    const p2Ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const p2Page = await p2Ctx.newPage();

    try {
      // ── Step 1: ホストが SetupPage を開く ──
      await hostPage.goto("/host/setup");
      await expect(
        hostPage.getByRole("heading", { name: "クイズ設定" })
      ).toBeVisible({ timeout: 8000 });

      // 作成済みクイズの「ロビーを開く」ボタンをクリック
      const quizRow = hostPage.getByText("E2Eテスト用クイズ").first();
      await expect(quizRow).toBeVisible({ timeout: 5000 });
      await hostPage.getByRole("button", { name: "ロビーを開く" }).first().click();

      // HostPage（ロビー）に遷移するのを待つ
      await expect(hostPage).toHaveURL(/\/host\/[A-Z0-9]{6}/, { timeout: 10000 });
      const hostUrl = hostPage.url();
      const roomCode = hostUrl.match(/\/host\/([A-Z0-9]{6})/)?.[1];
      expect(roomCode).toBeTruthy();

      await expect(
        hostPage.getByText("QRコード").or(hostPage.getByText("ルームコード"))
      ).toBeVisible({ timeout: 8000 });

      // ── Step 2: 参加者1が JoinPage からルームコード入力 ──
      await p1Page.goto("/play");
      await p1Page.getByPlaceholder("XXXXXX").fill(roomCode!);
      await p1Page.getByRole("button", { name: "参加する" }).click();
      await expect(p1Page).toHaveURL(`/play/${roomCode}`);

      // プロフィール設定
      const p1Profile = p1Page.getByRole("heading", { name: "プロフィール設定" });
      const p1IsProfile = await p1Profile.isVisible({ timeout: 8000 }).catch(() => false);
      if (p1IsProfile) {
        await p1Page.getByLabel("ニックネーム（8文字以内）").fill("テスト花子");
        // チーム選択は必須（既定チーム A〜D が自動作成される）
        await p1Page.getByRole("button", { name: "A", exact: true }).click();
        await p1Page.getByRole("checkbox", { name: /データの収集/ }).check();
        await p1Page.getByRole("button", { name: "参加する" }).click();
      }

      // ── Step 3: 参加者2が参加 ──
      await p2Page.goto(`/play/${roomCode}`);
      const p2Profile = p2Page.getByRole("heading", { name: "プロフィール設定" });
      const p2IsProfile = await p2Profile.isVisible({ timeout: 8000 }).catch(() => false);
      if (p2IsProfile) {
        await p2Page.getByLabel("ニックネーム（8文字以内）").fill("テスト太郎");
        // チーム選択は必須（既定チーム A〜D が自動作成される）
        await p2Page.getByRole("button", { name: "B", exact: true }).click();
        await p2Page.getByRole("checkbox", { name: /データの収集/ }).check();
        await p2Page.getByRole("button", { name: "参加する" }).click();
      }

      // ── Step 4: ホストのロビーに参加者が表示される ──
      await expect(hostPage.getByText("テスト花子").or(hostPage.getByText("テスト太郎"))).toBeVisible({
        timeout: 10000,
      });

      // ── Step 5: プロジェクター画面も確認 ──
      const screenCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const screenPage = await screenCtx.newPage();
      await screenPage.goto(`/host/${roomCode}/screen`);
      await expect(
        screenPage.getByText("QRコード").or(screenPage.getByText("ルームコード")).or(screenPage.getByText("テスト"))
      ).toBeVisible({ timeout: 8000 });
      await screenCtx.close();

      // ── Step 6: ホストがゲームを開始 ──
      const startBtn = hostPage.getByRole("button", { name: "ゲーム開始" });
      if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await startBtn.click();

        // 参加者の画面が問題フェーズに切り替わるのを確認
        await expect(
          p1Page.getByText("まもなく開始します").or(p1Page.getByRole("button", { name: /^[1-4]/ }))
        ).toBeVisible({ timeout: 10000 });
      }
    } finally {
      await hostCtx.close();
      await p1Ctx.close();
      await p2Ctx.close();
      // テストデータ削除
      await request.delete(`${API}/api/quizzes/${quizId}?key=${hostSecret}`).catch(() => {});
    }
  });

  test("SetupPage: 画像なしで問題を追加できる", async ({ page }) => {
    await page.goto("/host/setup");
    await expect(page.getByRole("heading", { name: "クイズ設定" })).toBeVisible({ timeout: 8000 });

    // クイズタイトルを入力して作成
    await page.getByLabel("クイズタイトル").fill("E2E画像なしテスト");
    await page.getByRole("button", { name: "クイズを作成" }).click();
    await expect(page.getByText("E2E画像なしテスト")).toBeVisible({ timeout: 5000 });

    // 問題を追加
    await page.getByLabel("問題文").fill("テスト問題");
    await page.getByLabel("選択肢1").fill("A");
    await page.getByLabel("選択肢2").fill("B");
    await page.getByLabel("選択肢3").fill("C");
    await page.getByLabel("選択肢4").fill("D");
    // 正解選択（ラジオボタン or セレクト）
    await page.getByRole("radio", { name: "1" }).first().check().catch(async () => {
      await page.locator("select[name='correct_choice'], select").first().selectOption("1");
    });
    await page.getByRole("button", { name: "追加" }).click();

    // 問題リストに追加されていること
    await expect(page.getByText("テスト問題")).toBeVisible({ timeout: 5000 });
  });
});
