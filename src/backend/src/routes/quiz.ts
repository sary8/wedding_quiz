import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, sql, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export const quizRoutes = new Hono();

function generateRoomCode(): string {
  const chars = "0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// クイズ作成（room code衝突時はリトライ）
quizRoutes.post("/", async (c) => {
  const body = await c.req.json<{ title: string }>();
  if (!body.title?.trim()) {
    return c.json({ error: "タイトルは必須です" }, 400);
  }

  const hostSecret = nanoid(32);
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const roomCode = generateRoomCode();
    try {
      const result = await db
        .insert(schema.quizzes)
        .values({
          room_code: roomCode,
          host_secret: hostSecret,
          title: body.title.trim(),
        })
        .returning();

      return c.json(result[0], 201);
    } catch (e) {
      const err = e as Error;
      if (err.message?.includes("UNIQUE constraint failed") && attempt < maxRetries - 1) {
        continue;
      }
      throw e;
    }
  }

  return c.json({ error: "ルームコードの生成に失敗しました。もう一度お試しください" }, 500);
});

// クイズ一覧（host_secretは除外、カウント付き）
quizRoutes.get("/", async (c) => {
  const rows = await db
    .select({
      id: schema.quizzes.id,
      room_code: schema.quizzes.room_code,
      title: schema.quizzes.title,
      status: schema.quizzes.status,
      current_question_index: schema.quizzes.current_question_index,
      created_at: schema.quizzes.created_at,
      question_count: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.quiz_id = quizzes.id)`.as("question_count"),
      participant_count: sql<number>`(SELECT COUNT(*) FROM participants WHERE participants.quiz_id = quizzes.id)`.as("participant_count"),
    })
    .from(schema.quizzes);
  return c.json(rows);
});

// クイズ取得（ホスト用：secretで認証）
quizRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const key = c.req.query("key");

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
    with: { questions: true },
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  if (quiz.host_secret !== key) {
    return c.json({ error: "認証エラー" }, 403);
  }

  return c.json(quiz);
});

// クイズ更新
quizRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ title?: string; key: string }>();

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }
  if (quiz.host_secret !== body.key) {
    return c.json({ error: "認証エラー" }, 403);
  }

  const updated = await db
    .update(schema.quizzes)
    .set({ title: body.title?.trim() || quiz.title })
    .where(eq(schema.quizzes.id, id))
    .returning();

  return c.json(updated[0]);
});

// クイズ削除
quizRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const key = c.req.query("key");

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }
  if (quiz.host_secret !== key) {
    return c.json({ error: "認証エラー" }, 403);
  }

  await db.delete(schema.quizzes).where(eq(schema.quizzes.id, id));
  return c.json({ success: true });
});

// 特定クイズの参加者一覧（host_secret認証）
quizRoutes.get("/:id/participants", async (c) => {
  const id = Number(c.req.param("id"));
  const key = c.req.query("key");

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }
  if (quiz.host_secret !== key) {
    return c.json({ error: "認証エラー" }, 403);
  }

  const rows = await db
    .select({
      id: schema.participants.id,
      nickname: schema.participants.nickname,
      selfie_file_name: schema.participants.selfie_file_name,
      total_score: schema.participants.total_score,
      current_rank: schema.participants.current_rank,
      joined_at: schema.participants.joined_at,
    })
    .from(schema.participants)
    .where(eq(schema.participants.quiz_id, id));

  return c.json(rows);
});

// 参加者個別削除（host_secret認証）
quizRoutes.delete("/:id/participants/:participantId", async (c) => {
  const quizId = Number(c.req.param("id"));
  const participantId = Number(c.req.param("participantId"));
  const key = c.req.query("key");

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }
  if (quiz.host_secret !== key) {
    return c.json({ error: "認証エラー" }, 403);
  }

  const participant = await db.query.participants.findFirst({
    where: and(
      eq(schema.participants.id, participantId),
      eq(schema.participants.quiz_id, quizId),
    ),
  });

  if (!participant) {
    return c.json({ error: "参加者が見つかりません" }, 404);
  }

  await db.delete(schema.participants).where(eq(schema.participants.id, participantId));
  return c.json({ success: true });
});

// 参加者一括削除（host_secret認証）
// body.ids 指定時: 指定IDのみ削除、未指定時: クイズの全参加者削除
quizRoutes.delete("/:id/participants", async (c) => {
  const quizId = Number(c.req.param("id"));
  const key = c.req.query("key");

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }
  if (quiz.host_secret !== key) {
    return c.json({ error: "認証エラー" }, 403);
  }

  const body = await c.req.json<{ ids?: number[] }>().catch(() => ({}));

  if ("ids" in body && Array.isArray(body.ids) && body.ids.length > 0) {
    await db.delete(schema.participants).where(
      and(
        eq(schema.participants.quiz_id, quizId),
        inArray(schema.participants.id, body.ids),
      ),
    );
    return c.json({ success: true, deleted: body.ids.length });
  }

  const result = await db.delete(schema.participants).where(
    eq(schema.participants.quiz_id, quizId),
  );
  return c.json({ success: true });
});

// 全参加者一覧（クイズ情報付き、認証なし）
// index.ts で /api/participants にマウント
export const participantRoutes = new Hono();

participantRoutes.get("/", async (c) => {
  const rows = await db
    .select({
      id: schema.participants.id,
      nickname: schema.participants.nickname,
      selfie_file_name: schema.participants.selfie_file_name,
      total_score: schema.participants.total_score,
      quiz_id: schema.participants.quiz_id,
      quiz_title: schema.quizzes.title,
      joined_at: schema.participants.joined_at,
    })
    .from(schema.participants)
    .innerJoin(schema.quizzes, eq(schema.participants.quiz_id, schema.quizzes.id));

  return c.json(rows);
});
