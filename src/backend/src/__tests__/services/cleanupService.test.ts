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

  it("finished以外のステータスは削除しない", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await createTestQuiz({
      roomCode: "333333",
      status: "lobby",
      finishedAt: twoHoursAgo,
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
