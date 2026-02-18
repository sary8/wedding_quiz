import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const quizRoutes = new Hono();

function generateRoomCode(): string {
  const chars = "0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
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

// クイズ一覧（host_secretは除外）
quizRoutes.get("/", async (c) => {
  const rows = await db
    .select({
      id: schema.quizzes.id,
      room_code: schema.quizzes.room_code,
      title: schema.quizzes.title,
      status: schema.quizzes.status,
      current_question_index: schema.quizzes.current_question_index,
      created_at: schema.quizzes.created_at,
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
