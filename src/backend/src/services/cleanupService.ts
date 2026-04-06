import { db, schema } from "../db/index.js";
import { eq, and, lte, or } from "drizzle-orm";
import { deleteQuizCompletely } from "./quizService.js";
import { logger } from "../utils/logger.js";

const CLEANUP_FINISHED_TTL_MS = 3_600_000;       // 1時間
const CLEANUP_DRAFT_TTL_MS = 86_400_000;          // 24時間
const CLEANUP_LOBBY_TTL_MS = 43_200_000;          // 12時間
const CLEANUP_IN_PROGRESS_TTL_MS = 21_600_000;    // 6時間
const CLEANUP_INTERVAL_MS = 600_000;               // 10分

async function cleanupExpiredQuizzes(): Promise<void> {
  const finishedCutoff = new Date(Date.now() - CLEANUP_FINISHED_TTL_MS).toISOString();
  const draftCutoff = new Date(Date.now() - CLEANUP_DRAFT_TTL_MS).toISOString();
  const lobbyCutoff = new Date(Date.now() - CLEANUP_LOBBY_TTL_MS).toISOString();
  const inProgressCutoff = new Date(Date.now() - CLEANUP_IN_PROGRESS_TTL_MS).toISOString();

  const expired = await db
    .select({ id: schema.quizzes.id, status: schema.quizzes.status })
    .from(schema.quizzes)
    .where(
      or(
        and(
          eq(schema.quizzes.status, "finished"),
          lte(schema.quizzes.finished_at, finishedCutoff)
        ),
        and(
          eq(schema.quizzes.status, "draft"),
          lte(schema.quizzes.created_at, draftCutoff)
        ),
        and(
          eq(schema.quizzes.status, "lobby"),
          lte(schema.quizzes.created_at, lobbyCutoff)
        ),
        and(
          eq(schema.quizzes.status, "in_progress"),
          lte(schema.quizzes.created_at, inProgressCutoff)
        )
      )
    );

  if (expired.length === 0) return;

  logger.info("cleanup: expired quizzes found", { count: expired.length });

  for (const quiz of expired) {
    try {
      await deleteQuizCompletely(quiz.id);
      logger.info("cleanup: deleted quiz", { quizId: quiz.id, status: quiz.status });
    } catch (e) {
      const err = e as Error;
      logger.error("cleanup: failed to delete quiz", { quizId: quiz.id, error: err.message });
    }
  }
}

export function startCleanupScheduler(): void {
  // サーバー起動時に1回実行
  cleanupExpiredQuizzes().catch((e) => {
    const err = e as Error;
    logger.error("cleanup: initial run failed", { error: err.message });
  });

  // 10分ごと定期実行
  const timer = setInterval(() => {
    cleanupExpiredQuizzes().catch((e) => {
      const err = e as Error;
      logger.error("cleanup: scheduled run failed", { error: err.message });
    });
  }, CLEANUP_INTERVAL_MS);

  // テスト時にタイマーリーク防止
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

// テスト用にエクスポート
export { cleanupExpiredQuizzes, CLEANUP_FINISHED_TTL_MS, CLEANUP_DRAFT_TTL_MS, CLEANUP_LOBBY_TTL_MS, CLEANUP_IN_PROGRESS_TTL_MS };
