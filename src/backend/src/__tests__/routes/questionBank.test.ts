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

    it("認証エラー → 403", async () => {
      const quiz = await createTestQuiz();
      const bq = await createTestBankQuestion();
      const res = await jsonRequest("/import-to-quiz", "POST", {
        quizId: quiz.id,
        key: "wrong-key",
        bankQuestionIds: [bq.id],
      });
      expect(res.status).toBe(403);
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
  });
});
