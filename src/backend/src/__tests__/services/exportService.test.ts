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

const { getExportData, buildCsv } = await import("../../services/exportService.js");

describe("exportService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("存在しないクイズ → null", async () => {
    const result = await getExportData(999);
    expect(result).toBeNull();
  });

  it("空のクイズでも基本情報を返す", async () => {
    const quiz = await createTestQuiz({ title: "テスト", status: "finished" });
    const result = await getExportData(quiz.id);

    expect(result).not.toBeNull();
    expect(result!.quiz.id).toBe(quiz.id);
    expect(result!.quiz.title).toBe("テスト");
    expect(result!.questions).toEqual([]);
    expect(result!.participants).toEqual([]);
    expect(result!.answers).toEqual([]);
  });

  it("問題・参加者・回答を含む完全なデータを返す", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const q1 = await createTestQuestion(quiz.id, { orderIndex: 0, text: "問題1", correctChoice: 1, pointMultiplier: 2 });
    const q2 = await createTestQuestion(quiz.id, { orderIndex: 1, text: "問題2", correctChoice: 2 });

    const p1 = await createTestParticipant(quiz.id, { nickname: "Aさん", totalScore: 1800 });
    const p2 = await createTestParticipant(quiz.id, { nickname: "Bさん", totalScore: 800, token: "token-b" });

    await createTestAnswer({ questionId: q1.id, participantId: p1.id, choiceIndex: 1, isCorrect: true, responseTimeMs: 3000, scoreAwarded: 1000 });
    await createTestAnswer({ questionId: q2.id, participantId: p1.id, choiceIndex: 2, isCorrect: true, responseTimeMs: 2000, scoreAwarded: 800 });
    await createTestAnswer({ questionId: q1.id, participantId: p2.id, choiceIndex: 3, isCorrect: false, responseTimeMs: 5000, scoreAwarded: 0 });
    await createTestAnswer({ questionId: q2.id, participantId: p2.id, choiceIndex: 2, isCorrect: true, responseTimeMs: 4000, scoreAwarded: 800 });

    const result = await getExportData(quiz.id);
    expect(result).not.toBeNull();

    // 問題
    expect(result!.questions).toHaveLength(2);
    expect(result!.questions[0].text).toBe("問題1");
    expect(result!.questions[0].pointMultiplier).toBe(2);
    expect(result!.questions[1].text).toBe("問題2");

    // 参加者（スコア降順）
    expect(result!.participants).toHaveLength(2);
    expect(result!.participants[0].nickname).toBe("Aさん");
    expect(result!.participants[0].rank).toBe(1);
    expect(result!.participants[0].correctCount).toBe(2);
    expect(result!.participants[1].nickname).toBe("Bさん");
    expect(result!.participants[1].rank).toBe(2);
    expect(result!.participants[1].correctCount).toBe(1);

    // 回答（ニックネーム→問題順でソート）
    expect(result!.answers).toHaveLength(4);
    expect(result!.answers[0].nickname).toBe("Aさん");
    expect(result!.answers[0].questionIndex).toBe(0);
    expect(result!.answers[0].isCorrect).toBe(true);
    expect(result!.answers[1].nickname).toBe("Aさん");
    expect(result!.answers[1].questionIndex).toBe(1);
    expect(result!.answers[2].nickname).toBe("Bさん");
    expect(result!.answers[2].questionIndex).toBe(0);
    expect(result!.answers[2].isCorrect).toBe(false);
    expect(result!.answers[3].nickname).toBe("Bさん");
    expect(result!.answers[3].questionIndex).toBe(1);
  });

  it("チームモードでチーム名が含まれる", async () => {
    const quiz = await createTestQuiz({ status: "finished" });
    const { db, testSchema } = await import("../helpers/testDb.js");
    const { eq } = await import("drizzle-orm");
    await db.update(testSchema.quizzes).set({ team_mode: true }).where(eq(testSchema.quizzes.id, quiz.id));

    const team = await createTestTeam(quiz.id, { name: "チームA" });
    await createTestParticipant(quiz.id, { nickname: "メンバー1", teamId: team.id });

    const result = await getExportData(quiz.id);
    expect(result!.quiz.teamMode).toBe(true);
    expect(result!.participants[0].teamName).toBe("チームA");
  });

  describe("buildCsv", () => {
    it("UTF-8 BOM付きCSVを生成する", async () => {
      const quiz = await createTestQuiz({ status: "finished" });
      const q = await createTestQuestion(quiz.id, { orderIndex: 0, text: "テスト問題", correctChoice: 1 });
      const p = await createTestParticipant(quiz.id, { nickname: "太郎", totalScore: 800 });
      await createTestAnswer({ questionId: q.id, participantId: p.id, choiceIndex: 1, isCorrect: true, responseTimeMs: 3000, scoreAwarded: 800 });

      const data = await getExportData(quiz.id);
      const csv = buildCsv(data!);

      // BOM
      expect(csv.charCodeAt(0)).toBe(0xFEFF);

      // セクション確認
      expect(csv).toContain("# クイズ情報");
      expect(csv).toContain("# 問題データ");
      expect(csv).toContain("# 参加者情報");
      expect(csv).toContain("# 回答履歴");

      // データ確認
      expect(csv).toContain("テストクイズ");
      expect(csv).toContain("テスト問題");
      expect(csv).toContain("太郎");
      expect(csv).toContain("正解");
    });

    it("カンマを含む値をエスケープする", async () => {
      const quiz = await createTestQuiz({ title: "テスト,クイズ", status: "finished" });
      const data = await getExportData(quiz.id);
      const csv = buildCsv(data!);

      expect(csv).toContain('"テスト,クイズ"');
    });

    it("先頭が=+\\-@の値に'が前置される（CSV式インジェクション防止）", async () => {
      const quiz = await createTestQuiz({ title: "=cmd", status: "finished" });
      await createTestQuestion(quiz.id, { orderIndex: 0, text: "+1+1", correctChoice: 1 });
      await createTestParticipant(quiz.id, { nickname: "-name", totalScore: 0 });

      const data = await getExportData(quiz.id);
      const csv = buildCsv(data!);

      // 先頭が危険文字の値に ' が前置される
      expect(csv).toContain("'=cmd");
      expect(csv).toContain("'+1+1");
      expect(csv).toContain("'-name");
    });

    it("@から始まる値にも'が前置される", async () => {
      const quiz = await createTestQuiz({ title: "@sum", status: "finished" });
      const data = await getExportData(quiz.id);
      const csv = buildCsv(data!);
      expect(csv).toContain("'@sum");
    });

    it("チームモードON時にチーム列が含まれる", async () => {
      const quiz = await createTestQuiz({ status: "finished" });
      const { db, testSchema } = await import("../helpers/testDb.js");
      const { eq } = await import("drizzle-orm");
      await db.update(testSchema.quizzes).set({ team_mode: true }).where(eq(testSchema.quizzes.id, quiz.id));

      const team = await createTestTeam(quiz.id, { name: "紅組" });
      await createTestParticipant(quiz.id, { nickname: "太郎", teamId: team.id, totalScore: 100 });

      const data = await getExportData(quiz.id);
      const csv = buildCsv(data!);

      expect(csv).toContain("チーム");
      expect(csv).toContain("紅組");
    });
  });
});
