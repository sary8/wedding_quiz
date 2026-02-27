import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTestDb, resetTestDb } from "../helpers/testDb.js";
import { createTestQuiz, createTestBankQuestion } from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const { questionBankRoutes } = await import("../../routes/questionBank.js");

function jsonRequest(path: string, method: string, body?: unknown) {
  return questionBankRoutes.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("questionBank routes", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("GET /", () => {
    it("空の場合は空配列", async () => {
      const res = await questionBankRoutes.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("問題一覧を返却", async () => {
      await createTestBankQuestion({ text: "問題A" });
      await createTestBankQuestion({ text: "問題B" });

      const res = await questionBankRoutes.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].text).toBe("問題A");
      expect(data[1].text).toBe("問題B");
    });
  });

  describe("POST /", () => {
    it("正常作成 → 201", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "新しい問題",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 2,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.text).toBe("新しい問題");
      expect(data.correct_choice).toBe(2);
      expect(data.time_limit_seconds).toBe(20);
      expect(data.points).toBe(1000);
    });

    it("カスタムオプション付き", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "カスタム問題",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 3,
        timeLimitSeconds: 30,
        points: 500,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.time_limit_seconds).toBe(30);
      expect(data.points).toBe(500);
    });

    it("問題文なし → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
      });
      expect(res.status).toBe(400);
    });

    it("選択肢不足 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "問題",
        choice1: "A", choice2: "", choice3: "C", choice4: "D",
        correctChoice: 1,
      });
      expect(res.status).toBe(400);
    });

    it("正解範囲外 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "問題",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 5,
      });
      expect(res.status).toBe(400);
    });

    it("問題文が500文字超 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "あ".repeat(501),
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
      });
      expect(res.status).toBe(400);
    });

    it("画像選択肢で作成 → 201", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "画像問題",
        choiceType: "image",
        choice1: "", choice2: "", choice3: "", choice4: "",
        choice1ImageUrl: "/api/media/1.jpg",
        choice2ImageUrl: "/api/media/2.jpg",
        choice3ImageUrl: "/api/media/3.jpg",
        choice4ImageUrl: "/api/media/4.jpg",
        correctChoice: 1,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.choice_type).toBe("image");
      expect(data.choice1_image_url).toBe("/api/media/1.jpg");
    });

    it("画像選択肢でURL不足 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "画像問題",
        choiceType: "image",
        choice1: "", choice2: "", choice3: "", choice4: "",
        choice1ImageUrl: "/api/media/1.jpg",
        correctChoice: 1,
      });
      expect(res.status).toBe(400);
    });

    it("不正なchoiceType → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "問題",
        choiceType: "video",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
      });
      expect(res.status).toBe(400);
    });

    it("制限時間範囲外 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "問題",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
        timeLimitSeconds: 3,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /:id", () => {
    it("部分更新 → 成功", async () => {
      const q = await createTestBankQuestion({ text: "元の問題" });
      const res = await jsonRequest(`/${q.id}`, "PUT", { text: "更新後" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.text).toBe("更新後");
      expect(data.choice1).toBe("バンク選択肢1"); // 変更なし
    });

    it("存在しないID → 404", async () => {
      const res = await jsonRequest("/9999", "PUT", { text: "更新" });
      expect(res.status).toBe(404);
    });

    it("バリデーションエラー → 400", async () => {
      const q = await createTestBankQuestion();
      const res = await jsonRequest(`/${q.id}`, "PUT", {
        text: "あ".repeat(501),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /:id", () => {
    it("正常削除 → 成功", async () => {
      const q = await createTestBankQuestion();
      const res = await questionBankRoutes.request(`/${q.id}`, { method: "DELETE" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // 削除確認
      const list = await questionBankRoutes.request("/", { method: "GET" });
      const items = await list.json();
      expect(items).toHaveLength(0);
    });

    it("存在しないID → 404", async () => {
      const res = await questionBankRoutes.request("/9999", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /import-to-quiz", () => {
    it("バンクの問題をクイズにインポート → 201", async () => {
      const quiz = await createTestQuiz();
      const bq1 = await createTestBankQuestion({ text: "バンク問題1" });
      const bq2 = await createTestBankQuestion({ text: "バンク問題2" });

      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        key: "test-secret-123",
        bankQuestionIds: [bq1.id, bq2.id],
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.count).toBe(2);
      expect(data.imported).toHaveLength(2);
    });

    it("存在しないクイズ → 404", async () => {
      const bq = await createTestBankQuestion();
      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: 9999,
        key: "any",
        bankQuestionIds: [bq.id],
      });
      expect(res.status).toBe(404);
    });

    it("空のID配列 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        key: "test-secret-123",
        bankQuestionIds: [],
      });
      expect(res.status).toBe(400);
    });

    it("画像選択肢のバンク問題をインポート → choice_type/image_url コピー", async () => {
      const quiz = await createTestQuiz();
      const bq = await createTestBankQuestion({
        text: "画像バンク問題",
        choiceType: "image",
        choice1ImageUrl: "/api/media/1.jpg",
        choice2ImageUrl: "/api/media/2.jpg",
        choice3ImageUrl: "/api/media/3.jpg",
        choice4ImageUrl: "/api/media/4.jpg",
      });

      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        bankQuestionIds: [bq.id],
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.count).toBe(1);

      // インポートされた問題を直接確認
      const { db, testSchema: schema } = await import("../helpers/testDb.js");
      const { eq } = await import("drizzle-orm");
      const imported = await db.query.questions.findFirst({
        where: eq(schema.questions.id, data.imported[0]),
      });
      expect(imported!.choice_type).toBe("image");
      expect(imported!.choice1_image_url).toBe("/api/media/1.jpg");
    });

    it("存在しないバンク問題IDはスキップ", async () => {
      const quiz = await createTestQuiz();
      const bq = await createTestBankQuestion({ text: "存在する問題" });

      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        key: "test-secret-123",
        bankQuestionIds: [bq.id, 9999],
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.count).toBe(1);
    });

    it("○×問題のインポート → question_type保持", async () => {
      const quiz = await createTestQuiz();
      const bq = await createTestBankQuestion({
        questionType: "true_false",
        choice1: "○", choice2: "×", choice3: null, choice4: null,
        correctChoice: 2,
      });

      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        bankQuestionIds: [bq.id],
      });
      expect(res.status).toBe(201);

      const { db, testSchema: schema } = await import("../helpers/testDb.js");
      const { eq } = await import("drizzle-orm");
      const imported = await db.query.questions.findFirst({
        where: eq(schema.questions.id, (await res.json()).imported[0]),
      });
      expect(imported!.question_type).toBe("true_false");
      expect(imported!.choice1).toBe("○");
      expect(imported!.choice3).toBeNull();
    });
  });

  describe("○×問題 (true_false)", () => {
    it("POST: ○×問題を追加 → choice1=○, choice2=×固定", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "○×バンク問題",
        questionType: "true_false",
        correctChoice: 1,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.question_type).toBe("true_false");
      expect(data.choice1).toBe("○");
      expect(data.choice2).toBe("×");
      expect(data.choice3).toBeNull();
      expect(data.choice4).toBeNull();
    });

    it("POST: ○×問題でcorrectChoice=3 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "テスト",
        questionType: "true_false",
        correctChoice: 3,
      });
      expect(res.status).toBe(400);
    });

    it("PUT: ○×に変更", async () => {
      const bq = await createTestBankQuestion();
      const res = await jsonRequest(`/${bq.id}`, "PUT", {
        questionType: "true_false",
        correctChoice: 2,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.question_type).toBe("true_false");
      expect(data.choice1).toBe("○");
      expect(data.choice2).toBe("×");
      expect(data.choice3).toBeNull();
    });
  });

  describe("ポイント倍率 (point_multiplier)", () => {
    it("POST: 倍率2で作成", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "倍率テスト",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
        pointMultiplier: 2,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.point_multiplier).toBe(2);
    });

    it("POST: 倍率省略 → デフォルト1", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "デフォルト",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.point_multiplier).toBe(1);
    });

    it("POST: 倍率4 → 400", async () => {
      const res = await jsonRequest("/", "POST", {
        text: "不正",
        choice1: "A", choice2: "B", choice3: "C", choice4: "D",
        correctChoice: 1,
        pointMultiplier: 4,
      });
      expect(res.status).toBe(400);
    });

    it("PUT: 倍率を3に変更", async () => {
      const q = await createTestBankQuestion();
      const res = await jsonRequest(`/${q.id}`, "PUT", { pointMultiplier: 3 });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.point_multiplier).toBe(3);
    });

    it("import: 倍率保持", async () => {
      const quiz = await createTestQuiz();
      const bq = await createTestBankQuestion({ pointMultiplier: 2 });

      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        bankQuestionIds: [bq.id],
      });
      expect(res.status).toBe(201);

      const { db, testSchema: schema } = await import("../helpers/testDb.js");
      const { eq } = await import("drizzle-orm");
      const imported = await db.query.questions.findFirst({
        where: eq(schema.questions.id, (await res.json()).imported[0]),
      });
      expect(imported!.point_multiplier).toBe(2);
    });
  });
});
