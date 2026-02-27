import { Hono } from "hono";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import { createTestQuiz, createTestQuestion, createTestParticipant, createTestAnswer, createTestTeam } from "../helpers/fixtures.js";

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

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新タイトル" }),
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

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999", {
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

    it("ids配列が200件超 → 400", async () => {
      const quiz = await createTestQuiz();
      const ids = Array.from({ length: 201 }, (_, i) => i + 1);

      const res = await quizRoutes.request(`/${quiz.id}/participants?key=test-secret-123`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("200人まで");
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

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999/participants", {
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

// ============================================================
// チーム関連エンドポイント
// ============================================================
describe("team routes", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("GET /room/:roomCode/info", () => {
    it("team_mode OFF → teamMode=false, teams空配列", async () => {
      await createTestQuiz({ roomCode: "1234" });

      const res = await quizRoutes.request("/room/1234/info", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teamMode).toBe(false);
      expect(data.teams).toEqual([]);
    });

    it("team_mode ON → teamMode=true, teams含む", async () => {
      const quiz = await createTestQuiz({ roomCode: "1234" });
      // team_modeをONにする
      await db.update(schema.quizzes).set({ team_mode: true }).where(eq(schema.quizzes.id, quiz.id));
      await createTestTeam(quiz.id, { name: "チームA", orderIndex: 0 });
      await createTestTeam(quiz.id, { name: "チームB", orderIndex: 1 });

      const res = await quizRoutes.request("/room/1234/info", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teamMode).toBe(true);
      expect(data.teams).toHaveLength(2);
      expect(data.teams[0].name).toBe("チームA");
      expect(data.teams[1].name).toBe("チームB");
    });

    it("存在しないroomCode → 404", async () => {
      const res = await quizRoutes.request("/room/9999/info", { method: "GET" });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id/team-mode", () => {
    it("team_mode ON → 成功", async () => {
      const quiz = await createTestQuiz();

      const res = await quizRoutes.request(`/${quiz.id}/team-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.teamMode).toBe(true);

      // DB確認
      const updated = await db.query.quizzes.findFirst({ where: eq(schema.quizzes.id, quiz.id) });
      expect(updated!.team_mode).toBe(true);
    });

    it("team_mode OFF → 成功", async () => {
      const quiz = await createTestQuiz();
      await db.update(schema.quizzes).set({ team_mode: true }).where(eq(schema.quizzes.id, quiz.id));

      const res = await quizRoutes.request(`/${quiz.id}/team-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teamMode).toBe(false);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999/team-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /:id/teams", () => {
    it("チーム一覧取得、order_index順", async () => {
      const quiz = await createTestQuiz();
      await createTestTeam(quiz.id, { name: "チームB", orderIndex: 1 });
      await createTestTeam(quiz.id, { name: "チームA", orderIndex: 0 });

      const res = await quizRoutes.request(`/${quiz.id}/teams`, { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("チームA");
      expect(data[1].name).toBe("チームB");
      expect(data[0]).toHaveProperty("id");
      expect(data[0]).toHaveProperty("orderIndex");
    });

    it("チームなし → 空配列", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/teams`, { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999/teams", { method: "GET" });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id/teams", () => {
    it("チーム一括設定（2チーム）→ 成功", async () => {
      const quiz = await createTestQuiz();

      const res = await quizRoutes.request(`/${quiz.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: [{ name: "紅組" }, { name: "白組" }] }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("紅組");
      expect(data[0].orderIndex).toBe(0);
      expect(data[1].name).toBe("白組");
      expect(data[1].orderIndex).toBe(1);
    });

    it("既存チーム削除→再作成、参加者のteam_idがnullにリセット", async () => {
      const quiz = await createTestQuiz();
      const team = await createTestTeam(quiz.id, { name: "旧チーム" });
      await createTestParticipant(quiz.id, { nickname: "太郎", teamId: team.id });

      const res = await quizRoutes.request(`/${quiz.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: [{ name: "新チームA" }, { name: "新チームB" }] }),
      });
      expect(res.status).toBe(200);

      // 参加者のteam_idがnullにリセットされている
      const p = await db.query.participants.findFirst({ where: eq(schema.participants.quiz_id, quiz.id) });
      expect(p!.team_id).toBeNull();
    });

    it("1チーム → 400（最低2チーム）", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: [{ name: "一つだけ" }] }),
      });
      expect(res.status).toBe(400);
    });

    it("11チーム → 400（最大10チーム）", async () => {
      const quiz = await createTestQuiz();
      const teams = Array.from({ length: 11 }, (_, i) => ({ name: `チーム${i + 1}` }));
      const res = await quizRoutes.request(`/${quiz.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
      });
      expect(res.status).toBe(400);
    });

    it("空のチーム名 → 400", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: [{ name: "OK" }, { name: "" }] }),
      });
      expect(res.status).toBe(400);
    });

    it("存在しないid → 404", async () => {
      const res = await quizRoutes.request("/9999/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: [{ name: "A" }, { name: "B" }] }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id/teams/:teamId", () => {
    it("チーム個別削除 → 成功", async () => {
      const quiz = await createTestQuiz();
      const team = await createTestTeam(quiz.id, { name: "削除対象" });

      const res = await quizRoutes.request(`/${quiz.id}/teams/${team.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // 削除確認
      const check = await quizRoutes.request(`/${quiz.id}/teams`, { method: "GET" });
      const remaining = await check.json();
      expect(remaining).toHaveLength(0);
    });

    it("存在しないチーム → 404", async () => {
      const quiz = await createTestQuiz();
      const res = await quizRoutes.request(`/${quiz.id}/teams/9999`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("別クイズのチーム → 404", async () => {
      const quiz1 = await createTestQuiz();
      const quiz2 = await createTestQuiz({ roomCode: "5678" });
      const team = await createTestTeam(quiz2.id, { name: "別クイズ" });

      const res = await quizRoutes.request(`/${quiz1.id}/teams/${team.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /:id （チーム情報含む）", () => {
    it("チームがある場合、teams配列が含まれる", async () => {
      const quiz = await createTestQuiz();
      await createTestTeam(quiz.id, { name: "チームA", orderIndex: 0 });
      await createTestTeam(quiz.id, { name: "チームB", orderIndex: 1 });

      const res = await quizRoutes.request(`/${quiz.id}?key=test-secret-123`, { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.teams).toHaveLength(2);
      expect(data.teams[0].name).toBe("チームA");
      expect(data.teams[1].name).toBe("チームB");
    });
  });
});
