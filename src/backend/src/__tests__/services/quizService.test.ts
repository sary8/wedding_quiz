import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import {
  createTestQuiz,
  createTestQuestion,
  createTestParticipant,
  createTestAnswer,
} from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const {
  verifyHostSecret,
  openRoom,
  joinRoom,
  handleDisconnect,
  getLobbyParticipants,
  startGame,
  getNextQuestion,
  submitAnswer,
  getAnswerCount,
  getQuestionResult,
  calculateRanking,
  getFinalResult,
  getQuizByRoom,
  getParticipant,
  replayQuiz,
} = await import("../../services/quizService.js");

import { eq } from "drizzle-orm";

describe("quizService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("verifyHostSecret", () => {
    it("正しいroomCode+secret → quiz返却", async () => {
      const quiz = await createTestQuiz();
      const result = await verifyHostSecret("ABCDEF", "test-secret-123");
      expect(result).not.toBeNull();
      expect(result!.id).toBe(quiz.id);
    });

    it("間違ったsecret → null", async () => {
      await createTestQuiz();
      const result = await verifyHostSecret("ABCDEF", "wrong-secret");
      expect(result).toBeNull();
    });

    it("存在しないroomCode → null", async () => {
      const result = await verifyHostSecret("XXXXXX", "test-secret-123");
      expect(result).toBeNull();
    });
  });

  describe("openRoom", () => {
    it("draft状態 → lobby遷移、roomCode返却", async () => {
      const quiz = await createTestQuiz({ status: "draft" });
      const roomCode = await openRoom(quiz.id, "test-secret-123");
      expect(roomCode).toBe("ABCDEF");

      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.status).toBe("lobby");
    });

    it("finished状態 → lobby遷移、roomCode返却", async () => {
      const quiz = await createTestQuiz({ status: "finished" });
      const roomCode = await openRoom(quiz.id, "test-secret-123");
      expect(roomCode).toBe("ABCDEF");
    });

    it("lobby状態 → roomCode返却、ステータス変更なし", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      const result = await openRoom(quiz.id, "test-secret-123");
      expect(result).toBe("ABCDEF");

      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.status).toBe("lobby");
    });

    it("in_progress状態 → roomCode返却、ステータス変更なし", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const result = await openRoom(quiz.id, "test-secret-123");
      expect(result).toBe("ABCDEF");

      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.status).toBe("in_progress");
    });

    it("間違ったsecret → null", async () => {
      const quiz = await createTestQuiz();
      const result = await openRoom(quiz.id, "wrong-secret");
      expect(result).toBeNull();
    });
  });

  describe("joinRoom", () => {
    it("新規参加 → participant作成、token返却、reconnect=false", async () => {
      await createTestQuiz({ status: "lobby" });
      const result = await joinRoom("ABCDEF", "ゲスト1", null, "conn-1");
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("participant");
      expect(result).toHaveProperty("reconnect", false);
      const { participant } = result as { participant: { id: number; token: string }; reconnect: boolean };
      expect(participant.id).toBeGreaterThan(0);
      expect(participant.token).toHaveLength(32);
    });

    it("既存token再接続 → reconnect=true", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      const existing = await createTestParticipant(quiz.id, {
        token: "existing-token-12345678901234567890",
        connectionId: "old-conn",
      });

      const result = await joinRoom(
        "ABCDEF",
        "ゲスト1",
        null,
        "new-conn",
        "existing-token-12345678901234567890"
      );
      expect(result).toHaveProperty("reconnect", true);
      const { participant } = result as { participant: { id: number; token: string }; reconnect: boolean };
      expect(participant.id).toBe(existing.id);
    });

    it("存在しないroomCode → error", async () => {
      const result = await joinRoom("XXXXXX", "ゲスト1", null, "conn-1");
      expect(result).toHaveProperty("error");
    });

    it("lobby/in_progress以外 → error", async () => {
      await createTestQuiz({ status: "draft" });
      const result = await joinRoom("ABCDEF", "ゲスト1", null, "conn-1");
      expect(result).toHaveProperty("error");
    });

    it("in_progress状態でも参加可能", async () => {
      await createTestQuiz({ status: "in_progress" });
      const result = await joinRoom("ABCDEF", "ゲスト1", null, "conn-1");
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("reconnect", false);
    });

    it("存在しないtoken → 新規参加として処理", async () => {
      await createTestQuiz({ status: "lobby" });
      const result = await joinRoom(
        "ABCDEF",
        "ゲスト1",
        null,
        "conn-new",
        "nonexistent-token-that-does-not-exist"
      );
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("reconnect", false);
    });

    it("同一クイズ内のニックネーム重複 → error", async () => {
      await createTestQuiz({ status: "lobby" });
      await joinRoom("ABCDEF", "ゲスト1", null, "conn-1");
      const result = await joinRoom("ABCDEF", "ゲスト1", null, "conn-2");
      expect(result).toHaveProperty("error", "このニックネームはすでに使われています");
    });

    it("再接続（token有）は同名でもOK", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      const existing = await createTestParticipant(quiz.id, {
        nickname: "ゲスト1",
        token: "reconnect-token-for-dedup-test123",
        connectionId: "old-conn",
      });

      const result = await joinRoom(
        "ABCDEF",
        "ゲスト1",
        null,
        "new-conn",
        "reconnect-token-for-dedup-test123"
      );
      expect(result).toHaveProperty("reconnect", true);
      const { participant } = result as { participant: { id: number; token: string }; reconnect: boolean };
      expect(participant.id).toBe(existing.id);
    });

    it("別クイズなら同名OK", async () => {
      await createTestQuiz({ status: "lobby", roomCode: "QUIZ01" });
      await createTestQuiz({ status: "lobby", roomCode: "QUIZ02" });

      const result1 = await joinRoom("QUIZ01", "ゲスト1", null, "conn-1");
      expect(result1).not.toHaveProperty("error");

      const result2 = await joinRoom("QUIZ02", "ゲスト1", null, "conn-2");
      expect(result2).not.toHaveProperty("error");
    });
  });

  describe("handleDisconnect", () => {
    it("is_connectedがfalseに更新", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      await createTestParticipant(quiz.id, {
        connectionId: "conn-to-disconnect",
        isConnected: true,
      });

      await handleDisconnect("conn-to-disconnect");

      const participants = await db
        .select()
        .from(schema.participants)
        .where(eq(schema.participants.connection_id, "conn-to-disconnect"));
      expect(participants[0].is_connected).toBe(false);
    });
  });

  describe("getLobbyParticipants", () => {
    it("参加者リスト返却、selfieUrl変換確認", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      await createTestParticipant(quiz.id, {
        nickname: "花子",
        selfieFileName: "selfie_abc.jpg",
        token: "token-1-unique",
      });
      await createTestParticipant(quiz.id, {
        nickname: "太郎",
        selfieFileName: null,
        token: "token-2-unique",
      });

      const list = await getLobbyParticipants("ABCDEF");
      expect(list).toHaveLength(2);

      const hanako = list.find((p) => p.nickname === "花子");
      expect(hanako!.selfieUrl).toBe("/api/media/selfie_abc.jpg");

      const taro = list.find((p) => p.nickname === "太郎");
      expect(taro!.selfieUrl).toBeNull();
    });

    it("存在しないroom → 空配列", async () => {
      const list = await getLobbyParticipants("XXXXXX");
      expect(list).toEqual([]);
    });
  });

  describe("startGame", () => {
    it("lobby状態 → in_progress、current_question_index=-1", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      const result = await startGame("ABCDEF");
      expect(result).toBe(quiz.id);

      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.status).toBe("in_progress");
      expect(updated!.current_question_index).toBe(-1);
    });

    it("lobby以外 → null", async () => {
      await createTestQuiz({ status: "draft" });
      expect(await startGame("ABCDEF")).toBeNull();
    });
  });

  describe("getNextQuestion", () => {
    it("次の問題を返却、current_question_index更新", async () => {
      const quiz = await createTestQuiz({
        status: "in_progress",
        currentQuestionIndex: -1,
      });
      const q1 = await createTestQuestion(quiz.id, {
        orderIndex: 0,
        text: "問題1",
        correctChoice: 2,
        timeLimitSeconds: 15,
      });
      await createTestQuestion(quiz.id, { orderIndex: 1, text: "問題2" });

      const result = await getNextQuestion("ABCDEF");
      expect(result).not.toBeNull();
      expect(result!.questionId).toBe(q1.id);
      expect(result!.questionIndex).toBe(0);
      expect(result!.totalQuestions).toBe(2);
      expect(result!.text).toBe("問題1");
      expect(result!.choices).toEqual(["選択肢1", "選択肢2", "選択肢3", "選択肢4"]);
      expect(result!.timeLimitSeconds).toBe(15);

      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.current_question_index).toBe(0);
    });

    it("全問終了 → null", async () => {
      const quiz = await createTestQuiz({
        status: "in_progress",
        currentQuestionIndex: 0,
      });
      await createTestQuestion(quiz.id, { orderIndex: 0 });

      const result = await getNextQuestion("ABCDEF");
      expect(result).toBeNull();
    });

    it("in_progress以外 → null", async () => {
      const quiz = await createTestQuiz({ status: "lobby" });
      await createTestQuestion(quiz.id, { orderIndex: 0 });
      expect(await getNextQuestion("ABCDEF")).toBeNull();
    });
  });

  describe("submitAnswer", () => {
    it("正解回答 → isCorrect=true、scoreAwarded>0、累計スコア更新", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id, {
        correctChoice: 2,
        timeLimitSeconds: 20,
      });
      const participant = await createTestParticipant(quiz.id, {
        token: "participant-token-1",
      });

      const result = await submitAnswer(participant.id, question.id, 2, 5000);
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("isCorrect", true);
      expect((result as { scoreAwarded: number }).scoreAwarded).toBeGreaterThan(0);

      // 累計スコア確認
      const updated = await db.query.participants.findFirst({
        where: eq(schema.participants.id, participant.id),
      });
      expect(updated!.total_score).toBe((result as { scoreAwarded: number }).scoreAwarded);
    });

    it("不正解回答 → isCorrect=false、scoreAwarded=0", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id, { correctChoice: 2 });
      const participant = await createTestParticipant(quiz.id, {
        token: "participant-token-2",
      });

      const result = await submitAnswer(participant.id, question.id, 3, 5000);
      expect(result).toHaveProperty("isCorrect", false);
      expect(result).toHaveProperty("scoreAwarded", 0);
    });

    it("重複回答 → error", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id, { correctChoice: 1 });
      const participant = await createTestParticipant(quiz.id, {
        token: "participant-token-3",
      });

      await submitAnswer(participant.id, question.id, 1, 5000);
      const result = await submitAnswer(participant.id, question.id, 2, 3000);
      expect(result).toHaveProperty("error");
    });

    it("存在しない問題ID → error", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const participant = await createTestParticipant(quiz.id, {
        token: "participant-token-invalid-q",
      });

      const result = await submitAnswer(participant.id, 9999, 1, 5000);
      expect(result).toHaveProperty("error");
    });
  });

  describe("getAnswerCount", () => {
    it("回答数カウント確認", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id);
      const p1 = await createTestParticipant(quiz.id, { token: "count-token-1" });
      const p2 = await createTestParticipant(quiz.id, { token: "count-token-2" });

      expect(await getAnswerCount(question.id)).toBe(0);

      await createTestAnswer({
        questionId: question.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1000,
      });
      expect(await getAnswerCount(question.id)).toBe(1);

      await createTestAnswer({
        questionId: question.id,
        participantId: p2.id,
        choiceIndex: 2,
        isCorrect: false,
        responseTimeMs: 2000,
      });
      expect(await getAnswerCount(question.id)).toBe(2);
    });
  });

  describe("getQuestionResult", () => {
    it("distribution配列が正確", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id, { correctChoice: 1 });
      const p1 = await createTestParticipant(quiz.id, { token: "result-token-1" });
      const p2 = await createTestParticipant(quiz.id, { token: "result-token-2" });
      const p3 = await createTestParticipant(quiz.id, { token: "result-token-3" });

      await createTestAnswer({
        questionId: question.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1000,
      });
      await createTestAnswer({
        questionId: question.id,
        participantId: p2.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 2000,
      });
      await createTestAnswer({
        questionId: question.id,
        participantId: p3.id,
        choiceIndex: 3,
        isCorrect: false,
        responseTimeMs: 3000,
      });

      const result = await getQuestionResult(question.id);
      expect(result.correctChoice).toBe(1);
      expect(result.distribution).toEqual([2, 0, 1, 0]);
      expect(result.yourAnswer).toBeUndefined();
    });

    it("participantId指定時にyourAnswer含む", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id, { correctChoice: 2 });
      const participant = await createTestParticipant(quiz.id, {
        token: "your-answer-token",
      });

      await createTestAnswer({
        questionId: question.id,
        participantId: participant.id,
        choiceIndex: 2,
        isCorrect: true,
        responseTimeMs: 1500,
        scoreAwarded: 800,
      });

      const result = await getQuestionResult(question.id, participant.id);
      expect(result.yourAnswer).toBeDefined();
      expect(result.yourAnswer!.choiceIndex).toBe(2);
      expect(result.yourAnswer!.isCorrect).toBe(true);
      expect(result.yourAnswer!.scoreAwarded).toBe(800);
      expect(result.yourAnswer!.responseTimeMs).toBe(1500);
    });

    it("participantId未指定時はyourAnswerなし", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id);

      const result = await getQuestionResult(question.id);
      expect(result.yourAnswer).toBeUndefined();
    });

    it("participantId指定だが未回答 → yourAnswerなし", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id);
      const participant = await createTestParticipant(quiz.id, {
        token: "no-answer-result-token",
      });

      const result = await getQuestionResult(question.id, participant.id);
      expect(result.yourAnswer).toBeUndefined();
    });

    it("存在しないquestionId → エラー", async () => {
      await expect(getQuestionResult(9999)).rejects.toThrow("Question not found");
    });

    it("choice_index範囲外の回答はdistributionに含まれない", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const question = await createTestQuestion(quiz.id, { correctChoice: 1 });
      const p = await createTestParticipant(quiz.id, { token: "choice-out-of-range" });

      // choice_index=0（範囲外: 1-4のみ有効）
      await createTestAnswer({
        questionId: question.id,
        participantId: p.id,
        choiceIndex: 0,
        isCorrect: false,
        responseTimeMs: 1000,
      });

      const result = await getQuestionResult(question.id);
      expect(result.distribution).toEqual([0, 0, 0, 0]);
    });
  });

  describe("calculateRanking", () => {
    it("スコア降順でrank付与、previousRank保持、lastResponseTimeMs取得", async () => {
      const quiz = await createTestQuiz({
        status: "in_progress",
        currentQuestionIndex: 0,
      });
      const question = await createTestQuestion(quiz.id, { orderIndex: 0 });
      const p1 = await createTestParticipant(quiz.id, {
        nickname: "高得点者",
        totalScore: 800,
        currentRank: 2,
        token: "rank-token-1",
      });
      const p2 = await createTestParticipant(quiz.id, {
        nickname: "低得点者",
        totalScore: 300,
        currentRank: 1,
        token: "rank-token-2",
      });

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
        responseTimeMs: 3000,
      });

      const rankings = await calculateRanking("ABCDEF");
      expect(rankings).toHaveLength(2);

      // スコア降順
      expect(rankings[0].nickname).toBe("高得点者");
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].previousRank).toBe(2);
      expect(rankings[0].lastResponseTimeMs).toBe(1500);

      expect(rankings[1].nickname).toBe("低得点者");
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].previousRank).toBe(1);
      expect(rankings[1].lastResponseTimeMs).toBe(3000);
    });

    it("存在しないroomCode → 空配列", async () => {
      const result = await calculateRanking("XXXXXX");
      expect(result).toEqual([]);
    });

    it("currentQuestionIndex=-1（問題配信前）→ lastResponseTimeMs=null", async () => {
      const quiz = await createTestQuiz({
        status: "in_progress",
        currentQuestionIndex: -1,
      });
      const p = await createTestParticipant(quiz.id, {
        nickname: "待機中",
        totalScore: 100,
        currentRank: 0,
        token: "rank-no-question-token",
      });

      const rankings = await calculateRanking("ABCDEF");
      expect(rankings).toHaveLength(1);
      expect(rankings[0].lastResponseTimeMs).toBeNull();
      // currentRank=0はfalsyなので || rank でrankが使われる
      expect(rankings[0].previousRank).toBe(1);
    });

    it("selfieUrl変換・未回答者のlastResponseTimeMs=null", async () => {
      const quiz = await createTestQuiz({
        status: "in_progress",
        currentQuestionIndex: 0,
      });
      const question = await createTestQuestion(quiz.id, { orderIndex: 0 });
      const p1 = await createTestParticipant(quiz.id, {
        nickname: "回答者",
        selfieFileName: "selfie_test.jpg",
        totalScore: 500,
        currentRank: 1,
        token: "rank-selfie-token-1",
      });
      const p2 = await createTestParticipant(quiz.id, {
        nickname: "未回答者",
        totalScore: 200,
        currentRank: 2,
        token: "rank-selfie-token-2",
      });

      await createTestAnswer({
        questionId: question.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 2000,
      });
      // p2は未回答

      const rankings = await calculateRanking("ABCDEF");
      expect(rankings[0].selfieUrl).toBe("/api/media/selfie_test.jpg");
      expect(rankings[0].lastResponseTimeMs).toBe(2000);
      expect(rankings[1].selfieUrl).toBeNull();
      expect(rankings[1].lastResponseTimeMs).toBeNull();
    });

    it("currentQuestionIndexが質問数を超える → lastResponseTimeMs=null", async () => {
      const quiz = await createTestQuiz({
        status: "in_progress",
        currentQuestionIndex: 99,
        roomCode: "OUTBND",
      });
      await createTestQuestion(quiz.id, { orderIndex: 0 });
      await createTestParticipant(quiz.id, {
        nickname: "テスト",
        totalScore: 100,
        token: "rank-outofbounds-token",
      });

      const rankings = await calculateRanking("OUTBND");
      expect(rankings).toHaveLength(1);
      expect(rankings[0].lastResponseTimeMs).toBeNull();
    });
  });

  describe("getFinalResult", () => {
    it("全参加者の統計、quiz status → finished更新", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const q1 = await createTestQuestion(quiz.id, {
        orderIndex: 0,
        correctChoice: 1,
      });
      const q2 = await createTestQuestion(quiz.id, {
        orderIndex: 1,
        correctChoice: 2,
      });
      const p1 = await createTestParticipant(quiz.id, {
        nickname: "プレイヤー1",
        selfieFileName: "selfie_final.jpg",
        totalScore: 1500,
        currentRank: 1,
        token: "final-token-1",
      });
      const p2 = await createTestParticipant(quiz.id, {
        nickname: "プレイヤー2",
        totalScore: 500,
        currentRank: 2,
        token: "final-token-2",
      });

      // p1: 2問正解
      await createTestAnswer({
        questionId: q1.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 1000,
        scoreAwarded: 900,
      });
      await createTestAnswer({
        questionId: q2.id,
        participantId: p1.id,
        choiceIndex: 2,
        isCorrect: true,
        responseTimeMs: 2000,
        scoreAwarded: 600,
      });

      // p2: 1問正解、1問不正解
      await createTestAnswer({
        questionId: q1.id,
        participantId: p2.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 3000,
        scoreAwarded: 500,
      });
      await createTestAnswer({
        questionId: q2.id,
        participantId: p2.id,
        choiceIndex: 3,
        isCorrect: false,
        responseTimeMs: 4000,
        scoreAwarded: 0,
      });

      const result = await getFinalResult("ABCDEF");
      expect(result.rankings).toHaveLength(2);

      // 1位: p1
      const first = result.rankings[0];
      expect(first.nickname).toBe("プレイヤー1");
      expect(first.selfieUrl).toBe("/api/media/selfie_final.jpg");
      expect(first.rank).toBe(1);
      expect(first.correctCount).toBe(2);
      expect(first.totalQuestions).toBe(2);
      expect(first.averageResponseTimeMs).toBe(1500); // (1000+2000)/2
      expect(first.fastestResponseTimeMs).toBe(1000);

      // 2位: p2
      const second = result.rankings[1];
      expect(second.nickname).toBe("プレイヤー2");
      expect(second.rank).toBe(2);
      expect(second.correctCount).toBe(1);
      expect(second.averageResponseTimeMs).toBe(3500); // (3000+4000)/2
      expect(second.fastestResponseTimeMs).toBe(3000);

      // quiz status → finished
      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.status).toBe("finished");
    });

    it("存在しないroomCode → 空ランキング", async () => {
      const result = await getFinalResult("XXXXXX");
      expect(result.rankings).toEqual([]);
    });

    it("参加者がいない場合 → 空ランキング（allAnswers空配列パス）", async () => {
      await createTestQuiz({ status: "in_progress" });
      const result = await getFinalResult("ABCDEF");
      expect(result.rankings).toEqual([]);
    });

    it("回答のない参加者 → avgTime/fastestTimeが0", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      await createTestQuestion(quiz.id, { orderIndex: 0 });
      await createTestParticipant(quiz.id, {
        nickname: "未回答者",
        totalScore: 0,
        token: "no-answer-token",
      });

      const result = await getFinalResult("ABCDEF");
      expect(result.rankings).toHaveLength(1);
      expect(result.rankings[0].correctCount).toBe(0);
      expect(result.rankings[0].averageResponseTimeMs).toBe(0);
      expect(result.rankings[0].fastestResponseTimeMs).toBe(0);
    });
  });

  describe("replayQuiz", () => {
    it("finished → lobby リセット、回答削除、スコアリセット", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const q1 = await createTestQuestion(quiz.id, { orderIndex: 0, correctChoice: 1 });
      const p1 = await createTestParticipant(quiz.id, {
        nickname: "プレイヤー1",
        totalScore: 1000,
        currentRank: 1,
        token: "replay-token-1",
      });

      await createTestAnswer({
        questionId: q1.id,
        participantId: p1.id,
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 2000,
        scoreAwarded: 1000,
      });

      // まずfinishedにする
      await getFinalResult("ABCDEF");
      const beforeReplay = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(beforeReplay!.status).toBe("finished");

      const result = await replayQuiz(quiz.id, "test-secret-123");
      expect(result).toHaveProperty("success", true);

      // status → lobby
      const updated = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, quiz.id),
      });
      expect(updated!.status).toBe("lobby");
      expect(updated!.current_question_index).toBe(-1);

      // スコアリセット
      const updatedP = await db.query.participants.findFirst({
        where: eq(schema.participants.id, p1.id),
      });
      expect(updatedP!.total_score).toBe(0);
      expect(updatedP!.current_rank).toBe(0);

      // 回答データ削除
      const answerCount = await getAnswerCount(q1.id);
      expect(answerCount).toBe(0);
    });

    it("finished以外 → error", async () => {
      const quiz = await createTestQuiz({ status: "in_progress" });
      const result = await replayQuiz(quiz.id, "test-secret-123");
      expect(result).toHaveProperty("error", "終了済みのクイズのみリプレイできます");
    });

    it("認証エラー → error", async () => {
      const quiz = await createTestQuiz({ status: "finished" });
      const result = await replayQuiz(quiz.id, "wrong-secret");
      expect(result).toHaveProperty("error", "認証エラー");
    });
  });

  describe("getQuizByRoom / getParticipant", () => {
    it("getQuizByRoom: roomCodeでクイズ取得", async () => {
      const quiz = await createTestQuiz();
      const result = await getQuizByRoom("ABCDEF");
      expect(result).not.toBeUndefined();
      expect(result!.id).toBe(quiz.id);
    });

    it("getParticipant: participantId取得", async () => {
      const quiz = await createTestQuiz();
      const participant = await createTestParticipant(quiz.id, {
        nickname: "テスト太郎",
        token: "get-participant-token",
      });
      const result = await getParticipant(participant.id);
      expect(result).not.toBeUndefined();
      expect(result!.nickname).toBe("テスト太郎");
    });
  });
});
