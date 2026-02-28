import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTestDb, resetTestDb } from "../helpers/testDb.js";
import {
  createTestQuiz,
  createTestQuestion,
  createTestParticipant,
  createTestAnswer,
  createTestTeam,
} from "../helpers/fixtures.js";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

const { getQuizStats } = await import("../../services/statsService.js");

describe("statsService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("存在しないクイズ → null", async () => {
    const result = await getQuizStats(999);
    expect(result).toBeNull();
  });

  it("問題・参加者なしでも空の統計を返す", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const result = await getQuizStats(quiz.id);

    expect(result).not.toBeNull();
    expect(result!.quizId).toBe(quiz.id);
    expect(result!.title).toBe("テストクイズ");
    expect(result!.totalParticipants).toBe(0);
    expect(result!.totalQuestions).toBe(0);
    expect(result!.questionStats).toEqual([]);
    expect(result!.participantStats).toEqual([]);
  });

  it("問題別統計を正しく計算する", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const q1 = await createTestQuestion(quiz.id, {
      orderIndex: 0,
      text: "問題1",
      correctChoice: 1,
    });
    const q2 = await createTestQuestion(quiz.id, {
      orderIndex: 1,
      text: "問題2",
      correctChoice: 2,
      pointMultiplier: 2,
    });

    const p1 = await createTestParticipant(quiz.id, { nickname: "Aさん", totalScore: 1800 });
    const p2 = await createTestParticipant(quiz.id, { nickname: "Bさん", totalScore: 1000, token: "token-b" });

    // Q1: p1正解, p2不正解
    await createTestAnswer({ questionId: q1.id, participantId: p1.id, choiceIndex: 1, isCorrect: true, responseTimeMs: 3000, scoreAwarded: 800 });
    await createTestAnswer({ questionId: q1.id, participantId: p2.id, choiceIndex: 2, isCorrect: false, responseTimeMs: 5000, scoreAwarded: 0 });

    // Q2: p1正解, p2正解
    await createTestAnswer({ questionId: q2.id, participantId: p1.id, choiceIndex: 2, isCorrect: true, responseTimeMs: 2000, scoreAwarded: 1000 });
    await createTestAnswer({ questionId: q2.id, participantId: p2.id, choiceIndex: 2, isCorrect: true, responseTimeMs: 4000, scoreAwarded: 1000 });

    const result = await getQuizStats(quiz.id);
    expect(result).not.toBeNull();
    expect(result!.totalParticipants).toBe(2);
    expect(result!.totalQuestions).toBe(2);

    // Q1統計
    const qs1 = result!.questionStats[0];
    expect(qs1.questionId).toBe(q1.id);
    expect(qs1.text).toBe("問題1");
    expect(qs1.totalAnswers).toBe(2);
    expect(qs1.correctCount).toBe(1);
    expect(qs1.correctRate).toBe(50);
    expect(qs1.averageResponseTimeMs).toBe(4000);
    expect(qs1.noAnswerCount).toBe(0);
    expect(qs1.difficulty).toBe("normal");
    expect(qs1.distribution).toEqual([1, 1, 0, 0]);

    // Q2統計（2倍問題）
    const qs2 = result!.questionStats[1];
    expect(qs2.correctRate).toBe(100);
    expect(qs2.pointMultiplier).toBe(2);
    expect(qs2.difficulty).toBe("easy");
    expect(qs2.distribution).toEqual([0, 2, 0, 0]);
  });

  it("参加者別統計を正しく計算する", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const q1 = await createTestQuestion(quiz.id, { orderIndex: 0, correctChoice: 1 });
    const q2 = await createTestQuestion(quiz.id, { orderIndex: 1, correctChoice: 2 });

    const p1 = await createTestParticipant(quiz.id, { nickname: "Aさん", totalScore: 1500 });
    const p2 = await createTestParticipant(quiz.id, { nickname: "Bさん", totalScore: 800, token: "token-b" });

    await createTestAnswer({ questionId: q1.id, participantId: p1.id, choiceIndex: 1, isCorrect: true, responseTimeMs: 3000, scoreAwarded: 800 });
    await createTestAnswer({ questionId: q2.id, participantId: p1.id, choiceIndex: 2, isCorrect: true, responseTimeMs: 2000, scoreAwarded: 700 });
    await createTestAnswer({ questionId: q1.id, participantId: p2.id, choiceIndex: 2, isCorrect: false, responseTimeMs: 5000, scoreAwarded: 0 });
    await createTestAnswer({ questionId: q2.id, participantId: p2.id, choiceIndex: 2, isCorrect: true, responseTimeMs: 4000, scoreAwarded: 800 });

    const result = await getQuizStats(quiz.id);
    expect(result!.participantStats).toHaveLength(2);

    // p1: 1位（スコア順）
    const ps1 = result!.participantStats[0];
    expect(ps1.nickname).toBe("Aさん");
    expect(ps1.rank).toBe(1);
    expect(ps1.correctCount).toBe(2);
    expect(ps1.correctRate).toBe(100);
    expect(ps1.averageResponseTimeMs).toBe(2500);
    expect(ps1.fastestResponseTimeMs).toBe(2000);
    expect(ps1.scoreProgress).toEqual([800, 1500]);

    // p2: 2位
    const ps2 = result!.participantStats[1];
    expect(ps2.nickname).toBe("Bさん");
    expect(ps2.rank).toBe(2);
    expect(ps2.correctCount).toBe(1);
    expect(ps2.correctRate).toBe(50);
    expect(ps2.scoreProgress).toEqual([0, 800]);
  });

  it("無回答をnoAnswerCountに反映する", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const q1 = await createTestQuestion(quiz.id, { orderIndex: 0, correctChoice: 1 });

    await createTestParticipant(quiz.id, { nickname: "回答者" });
    const p2 = await createTestParticipant(quiz.id, { nickname: "無回答者", token: "token-no" });

    // p1のみ回答（p2はcreateTestAnswerなし）
    const p1 = (await createTestParticipant(quiz.id, { nickname: "回答者2", token: "token-ans" }));
    await createTestAnswer({ questionId: q1.id, participantId: p1.id, choiceIndex: 1, isCorrect: true, responseTimeMs: 3000, scoreAwarded: 800 });

    const result = await getQuizStats(quiz.id);
    const qs = result!.questionStats[0];
    expect(qs.totalAnswers).toBe(1);
    expect(qs.noAnswerCount).toBe(2); // 3人中1人だけ回答
  });

  it("チームモードでチーム名が参加者に含まれる", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    // team_modeを直接設定するためDBを使う
    const { db, testSchema } = await import("../helpers/testDb.js");
    const { eq } = await import("drizzle-orm");
    await db.update(testSchema.quizzes).set({ team_mode: true }).where(eq(testSchema.quizzes.id, quiz.id));

    const team = await createTestTeam(quiz.id, { name: "チームA" });
    await createTestParticipant(quiz.id, { nickname: "メンバー1", teamId: team.id });

    const result = await getQuizStats(quiz.id);
    expect(result!.teamMode).toBe(true);
    expect(result!.participantStats[0].teamName).toBe("チームA");
  });

  it("○×問題のdistributionは2要素", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const q = await createTestQuestion(quiz.id, {
      orderIndex: 0,
      questionType: "true_false",
      choice1: "○",
      choice2: "×",
      choice3: null,
      choice4: null,
      correctChoice: 1,
    });

    const p = await createTestParticipant(quiz.id, { nickname: "回答者" });
    await createTestAnswer({ questionId: q.id, participantId: p.id, choiceIndex: 1, isCorrect: true, responseTimeMs: 2000, scoreAwarded: 900 });

    const result = await getQuizStats(quiz.id);
    const qs = result!.questionStats[0];
    expect(qs.distribution).toHaveLength(2);
    expect(qs.distribution).toEqual([1, 0]);
  });

  it("難易度の判定が正しい", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    // 正答率75%以上 → easy
    const q = await createTestQuestion(quiz.id, { orderIndex: 0, correctChoice: 1 });

    const tokens = ["t1", "t2", "t3", "t4"];
    const participants = await Promise.all(
      tokens.map((t) => createTestParticipant(quiz.id, { nickname: `P${t}`, token: t }))
    );

    // 4人中3人正解 → 75% → easy
    await createTestAnswer({ questionId: q.id, participantId: participants[0].id, choiceIndex: 1, isCorrect: true, responseTimeMs: 2000, scoreAwarded: 900 });
    await createTestAnswer({ questionId: q.id, participantId: participants[1].id, choiceIndex: 1, isCorrect: true, responseTimeMs: 3000, scoreAwarded: 800 });
    await createTestAnswer({ questionId: q.id, participantId: participants[2].id, choiceIndex: 1, isCorrect: true, responseTimeMs: 4000, scoreAwarded: 700 });
    await createTestAnswer({ questionId: q.id, participantId: participants[3].id, choiceIndex: 2, isCorrect: false, responseTimeMs: 5000, scoreAwarded: 0 });

    const result = await getQuizStats(quiz.id);
    expect(result!.questionStats[0].difficulty).toBe("easy");
  });
});
