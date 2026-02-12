import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import { createTestQuiz, createTestQuestion } from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const { quizRoutes } = await import("../../routes/quiz.js");

describe("quiz routes", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("POST /", () => {
    it("正常作成 → 201、roomCode/hostSecret含む", async () => {
      const res = await quizRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "結婚式クイズ" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("結婚式クイズ");
      expect(data.room_code).toBeTruthy();
      expect(data.room_code).toHaveLength(6);
      expect(data.host_secret).toBeTruthy();
      expect(data.status).toBe("draft");
    });

    it("タイトル空 → 400", async () => {
      const res = await quizRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });
      expect(res.status).toBe(400);
    });

    it("タイトルなし → 400", async () => {
      const res = await quizRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /", () => {
    it("一覧取得、host_secretが含まれない", async () => {
      await createTestQuiz({ title: "クイズ1" });

      const res = await quizRoutes.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe("クイズ1");
      expect(data[0]).not.toHaveProperty("host_secret");
    });
  });

  describe("GET /:id", () => {
    it("正しいkey → quiz+questions返却", async () => {
      const quiz = await createTestQuiz();
      await createTestQuestion(quiz.id, { text: "質問1" });

      const res = await quizRoutes.request(`/${quiz.id}?key=test-secret-123`, {
        method: "GET",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("テストクイズ");
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0].text).toBe("質問1");
    });

    it("間違ったkey → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}?key=wrong`, {
        method: "GET",
      });
      expect(res.status).toBe(403);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999?key=anything", {
        method: "GET",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id", () => {
    it("正しいkey+title → 更新成功", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-secret-123", title: "新タイトル" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("新タイトル");
    });

    it("titleなしで更新 → 既存タイトル維持", async () => {
      const quiz = await createTestQuiz({ title: "元のタイトル" });
      const res = await quizRoutes.request(`/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-secret-123" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("元のタイトル");
    });

    it("間違ったkey → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "wrong", title: "新タイトル" }),
      });
      expect(res.status).toBe(403);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "anything", title: "新タイトル" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it("正しいkey → 削除成功", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}?key=test-secret-123`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // 削除確認
      const check = await quizRoutes.request(`/${quiz.id}?key=test-secret-123`, {
        method: "GET",
      });
      expect(check.status).toBe(404);
    });

    it("間違ったkey → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}?key=wrong`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999?key=anything", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });
});
