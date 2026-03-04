import { db, schema } from "../db/index.js";
import { eq, and, lte } from "drizzle-orm";
import { deleteQuizCompletely } from "./quizService.js";
import { logger } from "../utils/logger.js";

const CLEANUP_TTL_MS = 3_600_000; // 1時間
const CLEANUP_INTERVAL_MS = 600_000; // 10分

async function cleanupExpiredQuizzes(): Promise<void> {
  const cutoff = new Date(Date.now() - CLEANUP_TTL_MS).toISOString();

  const expired = await db
    .select({ id: schema.quizzes.id })
    .from(schema.quizzes)
    .where(
      and(
        eq(schema.quizzes.status, "finished"),
        lte(schema.quizzes.finished_at, cutoff)
      )
    );

  if (expired.length === 0) return;

  logger.info("cleanup: expired quizzes found", { count: expired.length });

  for (const quiz of expired) {
    try {
      await deleteQuizCompletely(quiz.id);
      logger.info("cleanup: deleted quiz", { quizId: quiz.id });
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
  setInterval(() => {
    cleanupExpiredQuizzes().catch((e) => {
      const err = e as Error;
      logger.error("cleanup: scheduled run failed", { error: err.message });
    });
  }, CLEANUP_INTERVAL_MS);
}

// テスト用にエクスポート
export { cleanupExpiredQuizzes, CLEANUP_TTL_MS };
