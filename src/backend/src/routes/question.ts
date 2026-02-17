import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";

export const questionRoutes = new Hono();

// ホスト認証ヘルパー
async function verifyHost(quizId: number, key: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz) return { error: "クイズが見つかりません", status: 404 as const };
  if (quiz.host_secret !== key) return { error: "認証エラー", status: 403 as const };
  return { quiz };
}

// 問題の並べ替え（/:id より前に定義しないとマッチしない）
questionRoutes.put("/reorder", async (c) => {
  const body = await c.req.json<{
    quizId: number;
    key: string;
    questionIds: number[];
  }>();

  const auth = await verifyHost(body.quizId, body.key);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status);

  const reorderUpdates = body.questionIds.map((id, i) =>
    db
      .update(schema.questions)
      .set({ order_index: i })
      .where(
        and(
          eq(schema.questions.id, id),
          eq(schema.questions.quiz_id, body.quizId)
        )
      )
  );
  if (reorderUpdates.length > 0) {
    await db.batch(reorderUpdates as [typeof reorderUpdates[0], ...typeof reorderUpdates]);
  }

  return c.json({ success: true });
});

// 問題追加
questionRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    quizId: number;
    key: string;
    text: string;
    mediaType?: string;
    mediaUrl?: string;
    choice1: string;
    choice2: string;
    choice3: string;
    choice4: string;
    correctChoice: number;
    timeLimitSeconds?: number;
    points?: number;
  }>();

  const auth = await verifyHost(body.quizId, body.key);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status);

  // バリデーション
  if (!body.text?.trim()) {
    return c.json({ error: "問題文は必須です" }, 400);
  }
  if (!body.choice1?.trim() || !body.choice2?.trim() || !body.choice3?.trim() || !body.choice4?.trim()) {
    return c.json({ error: "すべての選択肢を入力してください" }, 400);
  }
  if (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > 4) {
    return c.json({ error: "正解は1〜4の整数で指定してください" }, 400);
  }
  if (body.timeLimitSeconds !== undefined && (!Number.isInteger(body.timeLimitSeconds) || body.timeLimitSeconds < 5 || body.timeLimitSeconds > 120)) {
    return c.json({ error: "制限時間は5〜120秒の整数で指定してください" }, 400);
  }
  if (body.points !== undefined && (!Number.isInteger(body.points) || body.points < 0 || body.points > 10000)) {
    return c.json({ error: "配点は0〜10000の整数で指定してください" }, 400);
  }

  // 末尾に追加するためにorder_indexの最大値を取得
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schema.questions.order_index}), -1)` })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, body.quizId));

  const result = await db
    .insert(schema.questions)
    .values({
      quiz_id: body.quizId,
      order_index: (maxOrder[0]?.max ?? -1) + 1,
      text: body.text,
      media_type: (body.mediaType as "none" | "image" | "video") || "none",
      media_url: body.mediaUrl || null,
      choice1: body.choice1,
      choice2: body.choice2,
      choice3: body.choice3,
      choice4: body.choice4,
      correct_choice: body.correctChoice,
      time_limit_seconds: body.timeLimitSeconds ?? 20,
      points: body.points ?? 1000,
    })
    .returning();

  return c.json(result[0], 201);
});

// 問題更新
questionRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    key: string;
    text?: string;
    mediaType?: string;
    mediaUrl?: string;
    choice1?: string;
    choice2?: string;
    choice3?: string;
    choice4?: string;
    correctChoice?: number;
    timeLimitSeconds?: number;
    points?: number;
  }>();

  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, id),
  });
  if (!question) return c.json({ error: "問題が見つかりません" }, 404);

  const auth = await verifyHost(question.quiz_id, body.key);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status);

  // バリデーション
  if (body.correctChoice !== undefined && (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > 4)) {
    return c.json({ error: "正解は1〜4の整数で指定してください" }, 400);
  }
  if (body.timeLimitSeconds !== undefined && (!Number.isInteger(body.timeLimitSeconds) || body.timeLimitSeconds < 5 || body.timeLimitSeconds > 120)) {
    return c.json({ error: "制限時間は5〜120秒の整数で指定してください" }, 400);
  }
  if (body.points !== undefined && (!Number.isInteger(body.points) || body.points < 0 || body.points > 10000)) {
    return c.json({ error: "配点は0〜10000の整数で指定してください" }, 400);
  }

  const updated = await db
    .update(schema.questions)
    .set({
      text: body.text ?? question.text,
      media_type: (body.mediaType as "none" | "image" | "video") ?? question.media_type,
      media_url: body.mediaUrl !== undefined ? body.mediaUrl : question.media_url,
      choice1: body.choice1 ?? question.choice1,
      choice2: body.choice2 ?? question.choice2,
      choice3: body.choice3 ?? question.choice3,
      choice4: body.choice4 ?? question.choice4,
      correct_choice: body.correctChoice ?? question.correct_choice,
      time_limit_seconds: body.timeLimitSeconds ?? question.time_limit_seconds,
      points: body.points ?? question.points,
    })
    .where(eq(schema.questions.id, id))
    .returning();

  return c.json(updated[0]);
});

// 問題削除
questionRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const key = c.req.query("key") || "";

  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, id),
  });
  if (!question) return c.json({ error: "問題が見つかりません" }, 404);

  const auth = await verifyHost(question.quiz_id, key);
  if ("error" in auth) return c.json({ error: auth.error }, auth.status);

  await db.delete(schema.questions).where(eq(schema.questions.id, id));
  return c.json({ success: true });
});

