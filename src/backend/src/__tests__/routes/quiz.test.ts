import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import { createTestQuiz, createTestQuestion, createTestParticipant } from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const { quizRoutes, participantRoutes } = await import("../../routes/quiz.js");

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
      expect(data.room_code).toHaveLength(4);
      expect(data.room_code).toMatch(/^\d{4}$/);
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

  describe("GET / (カウント付き)", () => {
    it("question_countとparticipant_countが含まれる", async () => {
      const quiz = await createTestQuiz();
      await createTestQuestion(quiz.id, { text: "問題1" });
      await createTestQuestion(quiz.id, { text: "問題2", orderIndex: 1 });
      await createTestParticipant(quiz.id, { nickname: "参加者1" });

      const res = await quizRoutes.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].question_count).toBe(2);
      expect(data[0].participant_count).toBe(1);
    });

    it("問題・参加者がない場合は0", async () => {
      await createTestQuiz();

      const res = await quizRoutes.request("/", { method: "GET" });
      const data = await res.json();
      expect(data[0].question_count).toBe(0);
      expect(data[0].participant_count).toBe(0);
    });
  });

  describe("GET /:id/participants", () => {
    it("正しいkey → 参加者一覧を返却", async () => {
      const quiz = await createTestQuiz();
      await createTestParticipant(quiz.id, { nickname: "太郎", totalScore: 500, currentRank: 1 });
      await createTestParticipant(quiz.id, { nickname: "花子", totalScore: 300, currentRank: 2 });

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].nickname).toBe("太郎");
      expect(data[0].total_score).toBe(500);
      expect(data[0].current_rank).toBe(1);
      expect(data[0]).toHaveProperty("joined_at");
    });

    it("参加者なし → 空配列", async () => {
      const quiz = await createTestQuiz();

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(0);
    });

    it("間違ったkey → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/participants?key=wrong`, {
        method: "GET",
      });
      expect(res.status).toBe(403);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999/participants?key=anything", {
        method: "GET",
      });
      expect(res.status).toBe(404);
    });
  });
});

describe("participant routes", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("GET /", () => {
    it("全クイズの参加者を横断取得", async () => {
      const quiz1 = await createTestQuiz({ title: "クイズ1" });
      const quiz2 = await createTestQuiz({ title: "クイズ2", roomCode: "5678" });
      await createTestParticipant(quiz1.id, { nickname: "太郎" });
      await createTestParticipant(quiz2.id, { nickname: "花子" });

      const res = await participantRoutes.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);

      const taro = data.find((p: Record<string, unknown>) => p.nickname === "太郎");
      const hanako = data.find((p: Record<string, unknown>) => p.nickname === "花子");
      expect(taro.quiz_title).toBe("クイズ1");
      expect(hanako.quiz_title).toBe("クイズ2");
    });

    it("参加者なし → 空配列", async () => {
      const res = await participantRoutes.request("/", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(0);
    });
  });
});
