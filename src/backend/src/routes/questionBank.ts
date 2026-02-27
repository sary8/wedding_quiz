import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, sql } from "drizzle-orm";

const VALID_MEDIA_TYPES = ["none", "image", "video"] as const;
type ValidMediaType = typeof VALID_MEDIA_TYPES[number];

const VALID_CHOICE_TYPES = ["text", "image"] as const;
type ValidChoiceType = typeof VALID_CHOICE_TYPES[number];

const VALID_QUESTION_TYPES = ["four_choice", "true_false"] as const;
type ValidQuestionType = typeof VALID_QUESTION_TYPES[number];

function isValidMediaType(v: unknown): v is ValidMediaType {
  return typeof v === "string" && (VALID_MEDIA_TYPES as readonly string[]).includes(v);
}

function isValidChoiceType(v: unknown): v is ValidChoiceType {
  return typeof v === "string" && (VALID_CHOICE_TYPES as readonly string[]).includes(v);
}

function isValidQuestionType(v: unknown): v is ValidQuestionType {
  return typeof v === "string" && (VALID_QUESTION_TYPES as readonly string[]).includes(v);
}

function validateQuestionFields(body: {
  text?: string;
  questionType?: string;
  choiceType?: string;
  choice1?: string;
  choice2?: string;
  choice3?: string | null;
  choice4?: string | null;
  choice1ImageUrl?: string | null;
  choice2ImageUrl?: string | null;
  choice3ImageUrl?: string | null;
  choice4ImageUrl?: string | null;
  correctChoice?: number;
  timeLimitSeconds?: number;
  points?: number;
  pointMultiplier?: number;
  mediaType?: string;
}, requireAll: boolean): string | null {
  if (body.questionType !== undefined && !isValidQuestionType(body.questionType)) {
    return "問題形式はfour_choice/true_falseのいずれかです";
  }
  if (body.choiceType !== undefined && !isValidChoiceType(body.choiceType)) {
    return "選択肢タイプはtext/imageのいずれかです";
  }
  const isTrueFalse = body.questionType === "true_false";

  if (requireAll) {
    if (!body.text?.trim()) return "問題文は必須です";
    if (isTrueFalse) {
      if (!Number.isInteger(body.correctChoice) || body.correctChoice! < 1 || body.correctChoice! > 2) {
        return "○×問題の正解は1（○）または2（×）で指定してください";
      }
    } else {
      const choiceType = body.choiceType ?? "text";
      if (choiceType === "text") {
        if (!body.choice1?.trim() || !body.choice2?.trim() || !body.choice3?.trim() || !body.choice4?.trim()) {
          return "すべての選択肢を入力してください";
        }
      } else {
        if (!body.choice1ImageUrl || !body.choice2ImageUrl || !body.choice3ImageUrl || !body.choice4ImageUrl) {
          return "画像選択肢では4つの画像URLが必須です";
        }
      }
      if (!Number.isInteger(body.correctChoice) || body.correctChoice! < 1 || body.correctChoice! > 4) {
        return "正解は1〜4の整数で指定してください";
      }
    }
  }
  if (body.text !== undefined && body.text.length > 500) return "問題文は500文字以内で入力してください";
  const choices = [body.choice1, body.choice2, body.choice3, body.choice4];
  if (choices.some((c) => c !== undefined && c !== null && c.length > 200)) return "選択肢は200文字以内で入力してください";
  if (body.correctChoice !== undefined) {
    const maxChoice = isTrueFalse ? 2 : 4;
    if (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > maxChoice) {
      return isTrueFalse ? "○×問題の正解は1（○）または2（×）で指定してください" : "正解は1〜4の整数で指定してください";
    }
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
  if (body.pointMultiplier !== undefined && (!Number.isInteger(body.pointMultiplier) || body.pointMultiplier < 1 || body.pointMultiplier > 3)) {
    return "ポイント倍率は1〜3の整数で指定してください";
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
    questionType?: string;
    choiceType?: string;
    choice1: string;
    choice2: string;
    choice3?: string;
    choice4?: string;
    choice1ImageUrl?: string;
    choice2ImageUrl?: string;
    choice3ImageUrl?: string;
    choice4ImageUrl?: string;
    correctChoice: number;
    timeLimitSeconds?: number;
    points?: number;
    pointMultiplier?: number;
    mediaType?: string;
    mediaUrl?: string;
  }>();

  const error = validateQuestionFields(body, true);
  if (error) return c.json({ error }, 400);

  const isTrueFalse = body.questionType === "true_false";

  const result = await db
    .insert(schema.questionBank)
    .values({
      text: body.text.trim(),
      question_type: (body.questionType ?? "four_choice") as "four_choice" | "true_false",
      media_type: (body.mediaType ?? "none") as "none" | "image" | "video",
      media_url: body.mediaUrl || null,
      choice_type: isTrueFalse ? "text" : ((body.choiceType ?? "text") as "text" | "image"),
      choice1: isTrueFalse ? "○" : (body.choice1?.trim() || ""),
      choice2: isTrueFalse ? "×" : (body.choice2?.trim() || ""),
      choice3: isTrueFalse ? null : (body.choice3?.trim() || ""),
      choice4: isTrueFalse ? null : (body.choice4?.trim() || ""),
      choice1_image_url: isTrueFalse ? null : (body.choice1ImageUrl || null),
      choice2_image_url: isTrueFalse ? null : (body.choice2ImageUrl || null),
      choice3_image_url: isTrueFalse ? null : (body.choice3ImageUrl || null),
      choice4_image_url: isTrueFalse ? null : (body.choice4ImageUrl || null),
      correct_choice: body.correctChoice,
      time_limit_seconds: body.timeLimitSeconds ?? 20,
      points: body.points ?? 1000,
      point_multiplier: body.pointMultiplier ?? 1,
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
    questionType?: string;
    choiceType?: string;
    choice1?: string;
    choice2?: string;
    choice3?: string | null;
    choice4?: string | null;
    choice1ImageUrl?: string | null;
    choice2ImageUrl?: string | null;
    choice3ImageUrl?: string | null;
    choice4ImageUrl?: string | null;
    correctChoice?: number;
    timeLimitSeconds?: number;
    points?: number;
    pointMultiplier?: number;
    mediaType?: string;
    mediaUrl?: string;
  }>();

  const existing = await db.query.questionBank.findFirst({
    where: eq(schema.questionBank.id, id),
  });
  if (!existing) return c.json({ error: "問題が見つかりません" }, 404);

  const error = validateQuestionFields(body, false);
  if (error) return c.json({ error }, 400);

  const effectiveQuestionType = body.questionType ?? existing.question_type;
  const isTrueFalse = effectiveQuestionType === "true_false";

  const updated = await db
    .update(schema.questionBank)
    .set({
      text: body.text?.trim() ?? existing.text,
      question_type: effectiveQuestionType as "four_choice" | "true_false",
      media_type: (body.mediaType as "none" | "image" | "video" | undefined) ?? existing.media_type,
      media_url: body.mediaUrl !== undefined ? (body.mediaUrl || null) : existing.media_url,
      choice_type: isTrueFalse ? "text" : ((body.choiceType as "text" | "image" | undefined) ?? existing.choice_type),
      choice1: isTrueFalse ? "○" : (body.choice1?.trim() ?? existing.choice1),
      choice2: isTrueFalse ? "×" : (body.choice2?.trim() ?? existing.choice2),
      choice3: isTrueFalse ? null : (body.choice3 !== undefined ? (body.choice3?.trim() ?? null) : existing.choice3),
      choice4: isTrueFalse ? null : (body.choice4 !== undefined ? (body.choice4?.trim() ?? null) : existing.choice4),
      choice1_image_url: isTrueFalse ? null : (body.choice1ImageUrl !== undefined ? (body.choice1ImageUrl || null) : existing.choice1_image_url),
      choice2_image_url: isTrueFalse ? null : (body.choice2ImageUrl !== undefined ? (body.choice2ImageUrl || null) : existing.choice2_image_url),
      choice3_image_url: isTrueFalse ? null : (body.choice3ImageUrl !== undefined ? (body.choice3ImageUrl || null) : existing.choice3_image_url),
      choice4_image_url: isTrueFalse ? null : (body.choice4ImageUrl !== undefined ? (body.choice4ImageUrl || null) : existing.choice4_image_url),
      correct_choice: body.correctChoice ?? existing.correct_choice,
      time_limit_seconds: body.timeLimitSeconds ?? existing.time_limit_seconds,
      points: body.points ?? existing.points,
      point_multiplier: body.pointMultiplier ?? existing.point_multiplier,
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
    bankQuestionIds: number[];
  }>();

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, body.quizId),
  });
  if (!quiz) return c.json({ error: "クイズが見つかりません" }, 404);

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
        question_type: bankQ.question_type,
        media_type: bankQ.media_type,
        media_url: bankQ.media_url,
        choice_type: bankQ.choice_type,
        choice1: bankQ.choice1,
        choice2: bankQ.choice2,
        choice3: bankQ.choice3,
        choice4: bankQ.choice4,
        choice1_image_url: bankQ.choice1_image_url,
        choice2_image_url: bankQ.choice2_image_url,
        choice3_image_url: bankQ.choice3_image_url,
        choice4_image_url: bankQ.choice4_image_url,
        correct_choice: bankQ.correct_choice,
        time_limit_seconds: bankQ.time_limit_seconds,
        points: bankQ.points,
        point_multiplier: bankQ.point_multiplier,
      })
      .returning();

    imported.push(result[0].id);
    nextOrder++;
  }

  return c.json({ imported, count: imported.length }, 201);
});
