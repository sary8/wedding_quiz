import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTestDb, resetTestDb, db, testSchema as schema } from "../helpers/testDb.js";
import { createTestQuiz } from "../helpers/fixtures.js";
import { eq } from "drizzle-orm";

vi.mock("../../db/index.js", async () => {
  const testDb = await import("../helpers/testDb.js");
  await testDb.initTestDb();
  return { db: testDb.db, schema: testDb.testSchema };
});

vi.mock("../../routes/media.js", () => ({
  deleteMediaFile: vi.fn().mockResolvedValue(undefined),
}));

const { cleanupExpiredQuizzes } = await import("../../services/cleanupService.js");

describe("cleanupService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("finished クイズ", () => {
    it("finished_atが1時間超のクイズを削除する", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "111111",
        status: "finished",
        finishedAt: twoHoursAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(0);
    });

    it("finished_atが1時間以内のクイズは削除しない", async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "222222",
        status: "finished",
        finishedAt: thirtyMinAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(1);
    });

    it("finished_atがnullのクイズは削除しない", async () => {
      await createTestQuiz({
        roomCode: "444444",
        status: "finished",
        finishedAt: null,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(1);
    });

    it("複数の期限切れクイズを一括削除する", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const recentlyFinished = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      await createTestQuiz({
        roomCode: "555555",
        status: "finished",
        finishedAt: twoHoursAgo,
      });
      await createTestQuiz({
        roomCode: "666666",
        status: "finished",
        finishedAt: twoHoursAgo,
      });
      await createTestQuiz({
        roomCode: "777777",
        status: "finished",
        finishedAt: recentlyFinished,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].room_code).toBe("777777");
    });
  });

  describe("draft クイズ", () => {
    it("24時間超のdraftクイズを削除する", async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "111111",
        status: "draft",
        createdAt: twoDaysAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(0);
    });

    it("24時間以内のdraftクイズは削除しない", async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "222222",
        status: "draft",
        createdAt: sixHoursAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(1);
    });
  });

  describe("lobby クイズ", () => {
    it("12時間超のlobbyクイズを削除する", async () => {
      const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "333333",
        status: "lobby",
        createdAt: thirteenHoursAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(0);
    });

    it("12時間以内のlobbyクイズは削除しない", async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "444444",
        status: "lobby",
        createdAt: sixHoursAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(1);
    });
  });

  describe("in_progress クイズ", () => {
    it("in_progressクイズは削除しない", async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await createTestQuiz({
        roomCode: "555555",
        status: "in_progress",
        createdAt: twoDaysAgo,
      });

      await cleanupExpiredQuizzes();

      const remaining = await db.select().from(schema.quizzes);
      expect(remaining).toHaveLength(1);
    });
  });
});
