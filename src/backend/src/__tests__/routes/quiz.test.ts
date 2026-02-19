import { Hono } from "hono";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import { createTestQuiz, createTestQuestion, createTestParticipant, createTestAnswer } from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const { quizRoutes, participantRoutes } = await import("../../routes/quiz.js");

// メインアプリと同じ構成で app.route() マウントしたテスト用アプリ
const app = new Hono();
app.route("/api/quizzes", quizRoutes);
app.route("/api/participants", participantRoutes);

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

  describe("DELETE /:id/participants/:participantId", () => {
    it("正しいkey → 個別削除成功", async () => {
      const quiz = await createTestQuiz();
      const p = await createTestParticipant(quiz.id, { nickname: "太郎" });

      const res = await quizRoutes.request(`/${quiz.id}/participants/${p.id}?key=test-secret-123`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // 削除確認
      const check = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      const checkData = await check.json();
      expect(checkData).toHaveLength(0);
    });

    it("間違ったkey → 403", async () => {
      const quiz = await createTestQuiz();
      const p = await createTestParticipant(quiz.id);
      const res = await quizRoutes.request(`/${quiz.id}/participants/${p.id}?key=wrong`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    it("存在しない参加者 → 404", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/participants/9999?key=test-secret-123`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("別クイズの参加者 → 404", async () => {
      const quiz1 = await createTestQuiz();
      const quiz2 = await createTestQuiz({ roomCode: "5678" });
      const p = await createTestParticipant(quiz2.id);

      const res = await quizRoutes.request(`/${quiz1.id}/participants/${p.id}?key=test-secret-123`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id/participants (一括)", () => {
    it("ids指定 → 指定参加者のみ削除", async () => {
      const quiz = await createTestQuiz();
      const p1 = await createTestParticipant(quiz.id, { nickname: "太郎" });
      const p2 = await createTestParticipant(quiz.id, { nickname: "花子" });
      const p3 = await createTestParticipant(quiz.id, { nickname: "次郎" });

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [p1.id, p3.id] }),
      });
      expect(res.status).toBe(200);

      // 花子だけ残っている
      const check = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      const remaining = await check.json();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].nickname).toBe("花子");
    });

    it("ids未指定 → 全参加者削除", async () => {
      const quiz = await createTestQuiz();
      await createTestParticipant(quiz.id, { nickname: "太郎" });
      await createTestParticipant(quiz.id, { nickname: "花子" });

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);

      const check = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      const remaining = await check.json();
      expect(remaining).toHaveLength(0);
    });

    it("間違ったkey → 403", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/participants?key=wrong`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE - 回答済み参加者の削除（FK制約テスト）", () => {
    it("個別削除: 回答を持つ参加者を削除できる", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id, { text: "テスト問題" });
      const p = await createTestParticipant(quiz.id, { nickname: "太郎" });
      await createTestAnswer({
        questionId: question.id,
        participantId: p.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1500,
        scoreAwarded: 1000,
      });

      const res = await quizRoutes.request(`/${quiz.id}/participants/${p.id}?key=test-secret-123`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const check = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      const remaining = await check.json();
      expect(remaining).toHaveLength(0);
    });

    it("一括削除（全員）: 回答を持つ参加者を削除できる", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id, { text: "テスト問題" });
      const p1 = await createTestParticipant(quiz.id, { nickname: "太郎" });
      const p2 = await createTestParticipant(quiz.id, { nickname: "花子" });
      await createTestAnswer({
        questionId: question.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1500,
      });
      await createTestAnswer({
        questionId: question.id,
        participantId: p2.id,
        choiceIndex: 2,
        isCorrect: false,
        responseTimeMs: 2000,
      });

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);

      const check = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      const remaining = await check.json();
      expect(remaining).toHaveLength(0);
    });

    it("一括削除（指定ID）: 回答を持つ参加者を指定削除できる", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id, { text: "テスト問題" });
      const p1 = await createTestParticipant(quiz.id, { nickname: "太郎" });
      const p2 = await createTestParticipant(quiz.id, { nickname: "花子" });
      await createTestAnswer({
        questionId: question.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1500,
      });

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [p1.id] }),
      });
      expect(res.status).toBe(200);

      const check = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "GET",
      });
      const remaining = await check.json();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].nickname).toBe("花子");
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

  describe("DELETE /", () => {
    it("全参加者を削除できる", async () => {
      const quiz1 = await createTestQuiz({ title: "クイズ1" });
      const quiz2 = await createTestQuiz({ title: "クイズ2", roomCode: "5678", hostSecret: "secret-2" });
      await createTestParticipant(quiz1.id, { nickname: "太郎" });
      await createTestParticipant(quiz2.id, { nickname: "花子" });

      const res = await participantRoutes.request("/", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const check = await participantRoutes.request("/", { method: "GET" });
      const remaining = await check.json();
      expect(remaining).toHaveLength(0);
    });

    it("回答済み参加者も削除できる", async () => {
      const quiz = await createTestQuiz();
      const question = await createTestQuestion(quiz.id);
      const p = await createTestParticipant(quiz.id, { nickname: "太郎" });
      await createTestAnswer({
        questionId: question.id,
        participantId: p.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1500,
      });

      const res = await participantRoutes.request("/", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const check = await participantRoutes.request("/", { method: "GET" });
      const remaining = await check.json();
      expect(remaining).toHaveLength(0);
    });

    it("参加者がいなくても成功する", async () => {
      const res = await participantRoutes.request("/", { method: "DELETE" });
      expect(res.status).toBe(200);
    });
  });
});

// ============================================================
// app.route() マウント経由の統合テスト
// ユニットテスト（quizRoutes.request）では見つからないルーティング問題を検出
// ============================================================
describe("app.route() 経由のルーティング", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("DELETE /api/quizzes/:id/participants → 参加者一括削除（クイズは残る）", async () => {
    const quiz = await createTestQuiz();
    await createTestParticipant(quiz.id, { nickname: "太郎" });
    await createTestParticipant(quiz.id, { nickname: "花子" });

    const res = await app.request(`/api/quizzes/${quiz.id}/participants?key=test-secret-123`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // 参加者が消えていること
    const pRes = await app.request(`/api/quizzes/${quiz.id}/participants?key=test-secret-123`, {
      method: "GET",
    });
    const participants = await pRes.json();
    expect(participants).toHaveLength(0);

    // クイズは残っていること（DELETE /:id に誤マッチしていないことを確認）
    const qRes = await app.request(`/api/quizzes/${quiz.id}?key=test-secret-123`, {
      method: "GET",
    });
    expect(qRes.status).toBe(200);
    const quizData = await qRes.json();
    expect(quizData.title).toBe("テストクイズ");
  });

  it("DELETE /api/quizzes/:id/participants/:participantId → 個別削除", async () => {
    const quiz = await createTestQuiz();
    const p1 = await createTestParticipant(quiz.id, { nickname: "太郎" });
    const p2 = await createTestParticipant(quiz.id, { nickname: "花子" });

    const res = await app.request(`/api/quizzes/${quiz.id}/participants/${p1.id}?key=test-secret-123`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    // 花子だけ残る
    const pRes = await app.request(`/api/quizzes/${quiz.id}/participants?key=test-secret-123`, {
      method: "GET",
    });
    const participants = await pRes.json();
    expect(participants).toHaveLength(1);
    expect(participants[0].nickname).toBe("花子");

    // クイズは残っている
    const qRes = await app.request(`/api/quizzes/${quiz.id}?key=test-secret-123`, {
      method: "GET",
    });
    expect(qRes.status).toBe(200);
  });

  it("DELETE /api/quizzes/:id → クイズ削除は別途正しく動く", async () => {
    const quiz = await createTestQuiz();

    const res = await app.request(`/api/quizzes/${quiz.id}?key=test-secret-123`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const qRes = await app.request(`/api/quizzes/${quiz.id}?key=test-secret-123`, {
      method: "GET",
    });
    expect(qRes.status).toBe(404);
  });

  it("GET /api/quizzes/:id/participants → 参加者一覧（GET /:id に誤マッチしない）", async () => {
    const quiz = await createTestQuiz();
    await createTestParticipant(quiz.id, { nickname: "太郎" });

    const res = await app.request(`/api/quizzes/${quiz.id}/participants?key=test-secret-123`, {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // 配列が返ること（GET /:id だとquizオブジェクトが返る）
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].nickname).toBe("太郎");
  });

  it("GET /api/participants → 全参加者横断取得", async () => {
    const quiz = await createTestQuiz();
    await createTestParticipant(quiz.id, { nickname: "太郎" });

    const res = await app.request("/api/participants", { method: "GET" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
  });
});
