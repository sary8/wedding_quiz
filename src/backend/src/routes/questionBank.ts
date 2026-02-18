import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, sql } from "drizzle-orm";

const VALID_MEDIA_TYPES = ["none", "image", "video"] as const;
type ValidMediaType = typeof VALID_MEDIA_TYPES[number];

function isValidMediaType(v: unknown): v is ValidMediaType {
  return typeof v === "string" && (VALID_MEDIA_TYPES as readonly string[]).includes(v);
}

function validateQuestionFields(body: {
  text?: string;
  choice1?: string;
  choice2?: string;
  choice3?: string;
  choice4?: string;
  correctChoice?: number;
  timeLimitSeconds?: number;
  points?: number;
  mediaType?: string;
}, requireAll: boolean): string | null {
  if (requireAll) {
    if (!body.text?.trim()) return "問題文は必須です";
    if (!body.choice1?.trim() || !body.choice2?.trim() || !body.choice3?.trim() || !body.choice4?.trim()) {
      return "すべての選択肢を入力してください";
    }
    if (!Number.isInteger(body.correctChoice) || body.correctChoice! < 1 || body.correctChoice! > 4) {
      return "正解は1〜4の整数で指定してください";
    }
  }
  if (body.text !== undefined && body.text.length > 500) return "問題文は500文字以内で入力してください";
  const choices = [body.choice1, body.choice2, body.choice3, body.choice4];
  if (choices.some((c) => c !== undefined && c.length > 200)) return "選択肢は200文字以内で入力してください";
  if (body.correctChoice !== undefined && (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > 4)) {
    return "正解は1〜4の整数で指定してください";
  }
  if (body.timeLimitSeconds !== undefined && (!Number.isInteger(body.timeLimitSeconds) || body.timeLimitSeconds < 5 || body.timeLimitSeconds > 120)) {
    return "制限時間は5〜120秒の整数で指定してください";
  }
  if (body.points !== undefined && (!Number.isInteger(body.points) || body.points < 0 || body.points > 10000)) {
    return "配点は0〜10000の整数で指定してください";
  }
  if (body.mediaType !== undefined && !isValidMediaType(body.mediaType)) {
    return "メディアタイプはnone/image/videoのいずれかです";
  }
  return null;
}

export const questionBankRoutes = new Hono();

// 一覧取得
questionBankRoutes.get("/", async (c) => {
  const rows = await db
    .select()
    .from(schema.questionBank)
    .orderBy(schema.questionBank.id);
  return c.json(rows);
});

// 追加
questionBankRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    text: string;
    choice1: string;
    choice2: string;
    choice3: string;
    choice4: string;
    correctChoice: number;
    timeLimitSeconds?: number;
    points?: number;
    mediaType?: string;
    mediaUrl?: string;
  }>();

  const error = validateQuestionFields(body, true);
  if (error) return c.json({ error }, 400);

  const result = await db
    .insert(schema.questionBank)
    .values({
      text: body.text.trim(),
      media_type: (body.mediaType ?? "none") as "none" | "image" | "video",
      media_url: body.mediaUrl || null,
      choice1: body.choice1.trim(),
      choice2: body.choice2.trim(),
      choice3: body.choice3.trim(),
      choice4: body.choice4.trim(),
      correct_choice: body.correctChoice,
      time_limit_seconds: body.timeLimitSeconds ?? 20,
      points: body.points ?? 1000,
      created_at: new Date().toISOString(),
    })
    .returning();

  return c.json(result[0], 201);
});

// 編集
questionBankRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    text?: string;
    choice1?: string;
    choice2?: string;
    choice3?: string;
    choice4?: string;
    correctChoice?: number;
    timeLimitSeconds?: number;
    points?: number;
    mediaType?: string;
    mediaUrl?: string;
  }>();

  const existing = await db.query.questionBank.findFirst({
    where: eq(schema.questionBank.id, id),
  });
  if (!existing) return c.json({ error: "問題が見つかりません" }, 404);

  const error = validateQuestionFields(body, false);
  if (error) return c.json({ error }, 400);

  const updated = await db
    .update(schema.questionBank)
    .set({
      text: body.text?.trim() ?? existing.text,
      media_type: (body.mediaType as "none" | "image" | "video" | undefined) ?? existing.media_type,
      media_url: body.mediaUrl !== undefined ? (body.mediaUrl || null) : existing.media_url,
      choice1: body.choice1?.trim() ?? existing.choice1,
      choice2: body.choice2?.trim() ?? existing.choice2,
      choice3: body.choice3?.trim() ?? existing.choice3,
      choice4: body.choice4?.trim() ?? existing.choice4,
      correct_choice: body.correctChoice ?? existing.correct_choice,
      time_limit_seconds: body.timeLimitSeconds ?? existing.time_limit_seconds,
      points: body.points ?? existing.points,
    })
    .where(eq(schema.questionBank.id, id))
    .returning();

  return c.json(updated[0]);
});

// 削除
questionBankRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));

  const existing = await db.query.questionBank.findFirst({
    where: eq(schema.questionBank.id, id),
  });
  if (!existing) return c.json({ error: "問題が見つかりません" }, 404);

  await db.delete(schema.questionBank).where(eq(schema.questionBank.id, id));
  return c.json({ success: true });
});

// バンクの問題をクイズにインポート
questionBankRoutes.post("/import-to-quiz", async (c) => {
  const body = await c.req.json<{
    quizId: number;
    key: string;
    bankQuestionIds: number[];
  }>();

  // ホスト認証
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, body.quizId),
  });
  if (!quiz) return c.json({ error: "クイズが見つかりません" }, 404);
  if (quiz.host_secret !== body.key) return c.json({ error: "認証エラー" }, 403);

  if (!Array.isArray(body.bankQuestionIds) || body.bankQuestionIds.length === 0) {
    return c.json({ error: "インポートする問題を選択してください" }, 400);
  }

  // 現在のorder_index最大値を取得
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schema.questions.order_index}), -1)` })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, body.quizId));
  let nextOrder = (maxOrder[0]?.max ?? -1) + 1;

  const imported: number[] = [];

  for (const bankId of body.bankQuestionIds) {
    const bankQ = await db.query.questionBank.findFirst({
      where: eq(schema.questionBank.id, bankId),
    });
    if (!bankQ) continue;

    const result = await db
      .insert(schema.questions)
      .values({
        quiz_id: body.quizId,
        order_index: nextOrder,
        text: bankQ.text,
        media_type: bankQ.media_type,
        media_url: bankQ.media_url,
        choice1: bankQ.choice1,
        choice2: bankQ.choice2,
        choice3: bankQ.choice3,
        choice4: bankQ.choice4,
        correct_choice: bankQ.correct_choice,
        time_limit_seconds: bankQ.time_limit_seconds,
        points: bankQ.points,
      })
      .returning();

    imported.push(result[0].id);
    nextOrder++;
  }

  return c.json({ imported, count: imported.length }, 201);
});
