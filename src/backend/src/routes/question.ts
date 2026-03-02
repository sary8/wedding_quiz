import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, and, sql, asc } from "drizzle-orm";
import { deleteMediaFile } from "./media.js";

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

export const questionRoutes = new Hono();

// クイズ存在チェック
async function verifyQuizExists(quizId: number) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz) return { error: "クイズが見つかりません", status: 404 as const };
  return { quiz };
}

// 問題の並べ替え（/:id より前に定義しないとマッチしない）
questionRoutes.put("/reorder", async (c) => {
  const body = await c.req.json<{
    quizId: number;
    questionIds: number[];
  }>().catch(() => null);
  if (!body) {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  const check = await verifyQuizExists(body.quizId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  if (!Array.isArray(body.questionIds) || body.questionIds.length === 0) {
    return c.json({ error: "questionIdsは空でない配列で指定してください" }, 400);
  }

  // 重複チェック
  const uniqueIds = new Set(body.questionIds);
  if (uniqueIds.size !== body.questionIds.length) {
    return c.json({ error: "questionIdsに重複があります" }, 400);
  }

  // 該当クイズの全問題IDを取得し、完全一致を検証
  const existingQuestions = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, body.quizId))
    .orderBy(asc(schema.questions.id));

  const existingIds = new Set(existingQuestions.map((q) => q.id));

  if (existingIds.size !== body.questionIds.length) {
    return c.json({ error: "questionIdsの件数がクイズの問題数と一致しません" }, 400);
  }

  for (const id of body.questionIds) {
    if (!existingIds.has(id)) {
      return c.json({ error: "このクイズに属さない問題IDが含まれています" }, 400);
    }
  }

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
    text: string;
    questionType?: string;
    mediaType?: string;
    mediaUrl?: string;
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
  }>().catch(() => null);
  if (!body) {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  const check = await verifyQuizExists(body.quizId);
  if ("error" in check) return c.json({ error: check.error }, check.status);

  // バリデーション
  if (!body.text?.trim()) {
    return c.json({ error: "問題文は必須です" }, 400);
  }
  if (body.text.length > 500) {
    return c.json({ error: "問題文は500文字以内で入力してください" }, 400);
  }
  if (body.questionType !== undefined && !isValidQuestionType(body.questionType)) {
    return c.json({ error: "問題形式はfour_choice/true_falseのいずれかです" }, 400);
  }
  const questionType = body.questionType ?? "four_choice";
  const isTrueFalse = questionType === "true_false";

  if (body.choiceType !== undefined && !isValidChoiceType(body.choiceType)) {
    return c.json({ error: "選択肢タイプはtext/imageのいずれかです" }, 400);
  }
  const choiceType = isTrueFalse ? "text" : (body.choiceType ?? "text");

  if (isTrueFalse) {
    if (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > 2) {
      return c.json({ error: "○×問題の正解は1（○）または2（×）で指定してください" }, 400);
    }
  } else {
    if (choiceType === "text") {
      if (!body.choice1?.trim() || !body.choice2?.trim() || !body.choice3?.trim() || !body.choice4?.trim()) {
        return c.json({ error: "すべての選択肢を入力してください" }, 400);
      }
    } else {
      if (!body.choice1ImageUrl || !body.choice2ImageUrl || !body.choice3ImageUrl || !body.choice4ImageUrl) {
        return c.json({ error: "画像選択肢では4つの画像URLが必須です" }, 400);
      }
    }
    if (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > 4) {
      return c.json({ error: "正解は1〜4の整数で指定してください" }, 400);
    }
  }
  const choices = [body.choice1, body.choice2, body.choice3, body.choice4];
  if (choices.some((ch) => ch !== undefined && ch.length > 200)) {
    return c.json({ error: "選択肢は200文字以内で入力してください" }, 400);
  }
  if (body.timeLimitSeconds !== undefined && (!Number.isInteger(body.timeLimitSeconds) || body.timeLimitSeconds < 5 || body.timeLimitSeconds > 120)) {
    return c.json({ error: "制限時間は5〜120秒の整数で指定してください" }, 400);
  }
  if (body.points !== undefined && (!Number.isInteger(body.points) || body.points < 0 || body.points > 10000)) {
    return c.json({ error: "配点は0〜10000の整数で指定してください" }, 400);
  }
  if (body.mediaType !== undefined && !isValidMediaType(body.mediaType)) {
    return c.json({ error: "メディアタイプはnone/image/videoのいずれかです" }, 400);
  }
  if (body.pointMultiplier !== undefined && (!Number.isInteger(body.pointMultiplier) || body.pointMultiplier < 1 || body.pointMultiplier > 3)) {
    return c.json({ error: "ポイント倍率は1〜3の整数で指定してください" }, 400);
  }

  // 末尾に追加するためにorder_indexの最大値を取得（トランザクションで保護）
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${schema.questions.order_index}), -1)` })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, body.quizId));

  const nextIndex = (maxOrder[0]?.max ?? -1) + 1;

  const result = await db
    .insert(schema.questions)
    .values({
      quiz_id: body.quizId,
      order_index: nextIndex,
      text: body.text,
      question_type: questionType,
      media_type: body.mediaType ?? "none",
      media_url: body.mediaUrl || null,
      choice_type: choiceType,
      choice1: isTrueFalse ? "○" : (body.choice1 || ""),
      choice2: isTrueFalse ? "×" : (body.choice2 || ""),
      choice3: isTrueFalse ? null : (body.choice3 || ""),
      choice4: isTrueFalse ? null : (body.choice4 || ""),
      choice1_image_url: isTrueFalse ? null : (body.choice1ImageUrl || null),
      choice2_image_url: isTrueFalse ? null : (body.choice2ImageUrl || null),
      choice3_image_url: isTrueFalse ? null : (body.choice3ImageUrl || null),
      choice4_image_url: isTrueFalse ? null : (body.choice4ImageUrl || null),
      correct_choice: body.correctChoice,
      time_limit_seconds: body.timeLimitSeconds ?? 20,
      points: body.points ?? 1000,
      point_multiplier: body.pointMultiplier ?? 1,
    })
    .returning();

  return c.json(result[0], 201);
});

// 問題更新
questionRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    text?: string;
    questionType?: string;
    mediaType?: string;
    mediaUrl?: string;
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
  }>().catch(() => null);
  if (!body) {
    return c.json({ error: "リクエストの形式が不正です" }, 400);
  }

  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, id),
  });
  if (!question) return c.json({ error: "問題が見つかりません" }, 404);

  // バリデーション
  if (body.text !== undefined && body.text.length > 500) {
    return c.json({ error: "問題文は500文字以内で入力してください" }, 400);
  }
  if (body.questionType !== undefined && !isValidQuestionType(body.questionType)) {
    return c.json({ error: "問題形式はfour_choice/true_falseのいずれかです" }, 400);
  }
  if (body.choiceType !== undefined && !isValidChoiceType(body.choiceType)) {
    return c.json({ error: "選択肢タイプはtext/imageのいずれかです" }, 400);
  }
  const effectiveQuestionType = body.questionType ?? question.question_type;
  const isTrueFalse = effectiveQuestionType === "true_false";

  const choices = [body.choice1, body.choice2, body.choice3, body.choice4];
  if (choices.some((ch) => ch !== undefined && ch !== null && ch.length > 200)) {
    return c.json({ error: "選択肢は200文字以内で入力してください" }, 400);
  }
  if (body.correctChoice !== undefined) {
    const maxChoice = isTrueFalse ? 2 : 4;
    if (!Number.isInteger(body.correctChoice) || body.correctChoice < 1 || body.correctChoice > maxChoice) {
      return c.json({ error: isTrueFalse ? "○×問題の正解は1（○）または2（×）で指定してください" : "正解は1〜4の整数で指定してください" }, 400);
    }
  }
  if (body.timeLimitSeconds !== undefined && (!Number.isInteger(body.timeLimitSeconds) || body.timeLimitSeconds < 5 || body.timeLimitSeconds > 120)) {
    return c.json({ error: "制限時間は5〜120秒の整数で指定してください" }, 400);
  }
  if (body.points !== undefined && (!Number.isInteger(body.points) || body.points < 0 || body.points > 10000)) {
    return c.json({ error: "配点は0〜10000の整数で指定してください" }, 400);
  }
  if (body.mediaType !== undefined && !isValidMediaType(body.mediaType)) {
    return c.json({ error: "メディアタイプはnone/image/videoのいずれかです" }, 400);
  }
  if (body.pointMultiplier !== undefined && (!Number.isInteger(body.pointMultiplier) || body.pointMultiplier < 1 || body.pointMultiplier > 3)) {
    return c.json({ error: "ポイント倍率は1〜3の整数で指定してください" }, 400);
  }

  const updated = await db
    .update(schema.questions)
    .set({
      text: body.text ?? question.text,
      question_type: effectiveQuestionType,
      media_type: body.mediaType ?? question.media_type,
      media_url: body.mediaUrl !== undefined ? body.mediaUrl : question.media_url,
      choice_type: isTrueFalse ? "text" : (body.choiceType ?? question.choice_type),
      choice1: isTrueFalse ? "○" : (body.choice1 ?? question.choice1),
      choice2: isTrueFalse ? "×" : (body.choice2 ?? question.choice2),
      choice3: isTrueFalse ? null : (body.choice3 !== undefined ? body.choice3 : question.choice3),
      choice4: isTrueFalse ? null : (body.choice4 !== undefined ? body.choice4 : question.choice4),
      choice1_image_url: isTrueFalse ? null : (body.choice1ImageUrl !== undefined ? (body.choice1ImageUrl || null) : question.choice1_image_url),
      choice2_image_url: isTrueFalse ? null : (body.choice2ImageUrl !== undefined ? (body.choice2ImageUrl || null) : question.choice2_image_url),
      choice3_image_url: isTrueFalse ? null : (body.choice3ImageUrl !== undefined ? (body.choice3ImageUrl || null) : question.choice3_image_url),
      choice4_image_url: isTrueFalse ? null : (body.choice4ImageUrl !== undefined ? (body.choice4ImageUrl || null) : question.choice4_image_url),
      correct_choice: body.correctChoice ?? question.correct_choice,
      time_limit_seconds: body.timeLimitSeconds ?? question.time_limit_seconds,
      points: body.points ?? question.points,
      point_multiplier: body.pointMultiplier ?? question.point_multiplier,
    })
    .where(eq(schema.questions.id, id))
    .returning();

  return c.json(updated[0]);
});

// 問題削除
questionRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));

  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, id),
  });
  if (!question) return c.json({ error: "問題が見つかりません" }, 404);

  await db.delete(schema.questions).where(eq(schema.questions.id, id));

  // メディアファイル削除
  await Promise.all([
    deleteMediaFile(question.media_url),
    deleteMediaFile(question.choice1_image_url),
    deleteMediaFile(question.choice2_image_url),
    deleteMediaFile(question.choice3_image_url),
    deleteMediaFile(question.choice4_image_url),
  ]);

  return c.json({ success: true });
});
