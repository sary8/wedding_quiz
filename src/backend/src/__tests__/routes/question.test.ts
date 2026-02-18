import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import { createTestQuiz, createTestQuestion } from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const { questionRoutes } = await import("../../routes/question.js");

import { eq } from "drizzle-orm";

describe("question routes", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("POST /", () => {
    it("正常追加 → 201、order_index自動付与", async () => {
      const quiz = await createTestQuiz();

      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "新郎の出身地は？",
          choice1: "東京",
          choice2: "大阪",
          choice3: "福岡",
          choice4: "北海道",
          correctChoice: 1,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.text).toBe("新郎の出身地は？");
      expect(data.order_index).toBe(0);
      expect(data.time_limit_seconds).toBe(20); // デフォルト
      expect(data.points).toBe(1000); // デフォルト
    });

    it("連続追加 → order_indexインクリメント", async () => {
      const quiz = await createTestQuiz();

      const body = {
        quizId: quiz.id,
        key: "test-secret-123",
        text: "質問",
        choice1: "A",
        choice2: "B",
        choice3: "C",
        choice4: "D",
        correctChoice: 1,
      };

      const res1 = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data1 = await res1.json();
      expect(data1.order_index).toBe(0);

      const res2 = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data2 = await res2.json();
      expect(data2.order_index).toBe(1);
    });

    it("認証エラー → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "wrong-key",
          text: "質問",
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
        }),
      });
      expect(res.status).toBe(403);
    });

    it("correctChoiceが範囲外 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "質問",
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 5,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("timeLimitSecondsが範囲外 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "質問",
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
          timeLimitSeconds: -1,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("問題文が空 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "  ",
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("問題文が500文字超 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "あ".repeat(501),
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("500文字");
    });

    it("選択肢が200文字超 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "質問",
          choice1: "あ".repeat(201),
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("200文字");
    });

    it("不正なmediaType → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          text: "質問",
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
          mediaType: "audio",
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("メディアタイプ");
    });

    it("存在しないquizId → 404", async () => {
      const res = await questionRoutes.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: 9999,
          key: "any-key",
          text: "質問",
          choice1: "A",
          choice2: "B",
          choice3: "C",
          choice4: "D",
          correctChoice: 1,
        }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id", () => {
    it("部分更新（textのみ）→ 他フィールド維持", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id, {
        text: "元の質問",
        choice1: "元の選択肢1",
        timeLimitSeconds: 30,
      });

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          text: "更新後の質問",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.text).toBe("更新後の質問");
      expect(data.choice1).toBe("元の選択肢1");
      expect(data.time_limit_seconds).toBe(30);
    });

    it("全フィールド更新（mediaUrl含む）", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          text: "新しい質問",
          mediaType: "image",
          mediaUrl: "/api/media/test.jpg",
          choice1: "新A",
          choice2: "新B",
          choice3: "新C",
          choice4: "新D",
          correctChoice: 3,
          timeLimitSeconds: 15,
          points: 500,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.text).toBe("新しい質問");
      expect(data.media_type).toBe("image");
      expect(data.media_url).toBe("/api/media/test.jpg");
      expect(data.choice1).toBe("新A");
      expect(data.correct_choice).toBe(3);
      expect(data.time_limit_seconds).toBe(15);
      expect(data.points).toBe(500);
    });

    it("text未指定 → 既存textが維持される", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id, {
        text: "元の質問テキスト",
      });

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          choice1: "更新後のA",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.text).toBe("元の質問テキスト");
      expect(data.choice1).toBe("更新後のA");
    });

    it("問題文が500文字超で更新 → 400", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          text: "あ".repeat(501),
        }),
      });
      expect(res.status).toBe(400);
    });

    it("選択肢が200文字超で更新 → 400", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          choice3: "あ".repeat(201),
        }),
      });
      expect(res.status).toBe(400);
    });

    it("不正なmediaTypeで更新 → 400", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          mediaType: "pdf",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("correctChoiceが範囲外で更新 → 400", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "test-secret-123",
          correctChoice: 0,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("存在しないid → 404", async () => {
      const res = await questionRoutes.request("/9999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "test-secret-123", text: "更新" }),
      });
      expect(res.status).toBe(404);
    });

    it("認証エラー → 403", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "wrong-key", text: "更新" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /:id", () => {
    it("正常削除", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(
        `/${question.id}?key=test-secret-123`,
        { method: "DELETE" }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // 削除確認
      const check = await db.query.questions.findFirst({
        where: eq(schema.questions.id, question.id),
      });
      expect(check).toBeUndefined();
    });

    it("存在しないid → 404", async () => {
      const res = await questionRoutes.request("/9999?key=anything", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("認証エラー → 403", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(
        `/${question.id}?key=wrong-key`,
        { method: "DELETE" }
      );
      expect(res.status).toBe(403);
    });

    it("keyパラメータなし → 403（空文字フォールバック）", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);

      const res = await questionRoutes.request(`/${question.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("PUT /reorder", () => {
    it("並べ替え成功、order_index更新確認", async () => {
      const quiz = await createTestQuiz();
      const q1 = await createTestQuestion(quiz.id, {
        orderIndex: 0,
        text: "質問1",
      });
      const q2 = await createTestQuestion(quiz.id, {
        orderIndex: 1,
        text: "質問2",
      });
      const q3 = await createTestQuestion(quiz.id, {
        orderIndex: 2,
        text: "質問3",
      });

      // 逆順に並べ替え: q3, q1, q2
      const res = await questionRoutes.request("/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "test-secret-123",
          questionIds: [q3.id, q1.id, q2.id],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // order_index確認
      const updated1 = await db.query.questions.findFirst({
        where: eq(schema.questions.id, q1.id),
      });
      const updated2 = await db.query.questions.findFirst({
        where: eq(schema.questions.id, q2.id),
      });
      const updated3 = await db.query.questions.findFirst({
        where: eq(schema.questions.id, q3.id),
      });
      expect(updated3!.order_index).toBe(0);
      expect(updated1!.order_index).toBe(1);
      expect(updated2!.order_index).toBe(2);
    });

    it("認証エラー → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await questionRoutes.request("/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          key: "wrong-key",
          questionIds: [],
        }),
      });
      expect(res.status).toBe(403);
    });
  });
});
