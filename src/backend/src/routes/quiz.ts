import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, sql, and, inArray, asc, desc } from "drizzle-orm";
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

// クイズ取得（admin認証済みのためhost_secret含む）
quizRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
    with: {
      questions: {
        orderBy: [asc(schema.questions.order_index)],
      },
      teams: {
        orderBy: [asc(schema.teams.order_index)],
      },
    },
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  return c.json(quiz);
});

// クイズ更新
quizRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ title?: string }>();

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  const updated = await db
    .update(schema.quizzes)
    .set({ title: body.title?.trim() || quiz.title })
    .where(eq(schema.quizzes.id, id))
    .returning();

  const { host_secret: _, ...updatedWithoutSecret } = updated[0];
  return c.json(updatedWithoutSecret);
});

// 特定クイズの参加者一覧
quizRoutes.get("/:id/participants", async (c) => {
  const id = Number(c.req.param("id"));

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
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

// 参加者個別削除
// ※ /:id より具体的なパスを先に定義（Honoのルート優先順位対策）
quizRoutes.delete("/:id/participants/:participantId", async (c) => {
  const quizId = Number(c.req.param("id"));
  const participantId = Number(c.req.param("participantId"));

  const participant = await db.query.participants.findFirst({
    where: and(
      eq(schema.participants.id, participantId),
      eq(schema.participants.quiz_id, quizId),
    ),
  });

  if (!participant) {
    return c.json({ error: "参加者が見つかりません" }, 404);
  }

  await db.delete(schema.answers).where(eq(schema.answers.participant_id, participantId));
  await db.delete(schema.participants).where(eq(schema.participants.id, participantId));
  return c.json({ success: true });
});

// 参加者一括削除
// body.ids 指定時: 指定IDのみ削除、未指定時: クイズの全参加者削除
quizRoutes.delete("/:id/participants", async (c) => {
  const quizId = Number(c.req.param("id"));

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  const body = await c.req.json<{ ids?: number[] }>().catch(() => ({}));

  if ("ids" in body && Array.isArray(body.ids) && body.ids.length > 200) {
    return c.json({ error: "一度に削除できる参加者は200人までです" }, 400);
  }

  if ("ids" in body && Array.isArray(body.ids) && body.ids.length > 0) {
    await db.delete(schema.answers).where(
      inArray(schema.answers.participant_id, body.ids),
    );
    await db.delete(schema.participants).where(
      and(
        eq(schema.participants.quiz_id, quizId),
        inArray(schema.participants.id, body.ids),
      ),
    );
    return c.json({ success: true, deleted: body.ids.length });
  }

  const participantIds = await db
    .select({ id: schema.participants.id })
    .from(schema.participants)
    .where(eq(schema.participants.quiz_id, quizId));

  if (participantIds.length > 0) {
    await db.delete(schema.answers).where(
      inArray(schema.answers.participant_id, participantIds.map((p) => p.id)),
    );
  }
  await db.delete(schema.participants).where(
    eq(schema.participants.quiz_id, quizId),
  );
  return c.json({ success: true });
});

// ルーム情報取得（参加者がチーム選択用に取得）
quizRoutes.get("/room/:roomCode/info", async (c) => {
  const roomCode = c.req.param("roomCode");
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) {
    return c.json({ error: "ルームが見つかりません" }, 404);
  }

  let teams: { id: number; name: string; order_index: number }[] = [];
  if (quiz.team_mode) {
    teams = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.quiz_id, quiz.id))
      .orderBy(asc(schema.teams.order_index));
  }

  return c.json({
    teamMode: quiz.team_mode,
    teams: teams.map((t) => ({ id: t.id, name: t.name, orderIndex: t.order_index })),
  });
});

// チームモード切替
quizRoutes.put("/:id/team-mode", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ enabled: boolean }>();

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });
  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  await db
    .update(schema.quizzes)
    .set({ team_mode: body.enabled })
    .where(eq(schema.quizzes.id, id));

  return c.json({ success: true, teamMode: body.enabled });
});

// チーム一覧取得
quizRoutes.get("/:id/teams", async (c) => {
  const id = Number(c.req.param("id"));

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });
  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  const teams = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.quiz_id, id))
    .orderBy(asc(schema.teams.order_index));

  return c.json(teams.map((t) => ({ id: t.id, name: t.name, orderIndex: t.order_index })));
});

// チーム一括設定
quizRoutes.put("/:id/teams", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ teams: { name: string }[] }>();

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });
  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  if (!Array.isArray(body.teams) || body.teams.length < 2 || body.teams.length > 10) {
    return c.json({ error: "チームは2〜10個で設定してください" }, 400);
  }

  for (const t of body.teams) {
    if (!t.name?.trim()) {
      return c.json({ error: "チーム名は必須です" }, 400);
    }
  }

  // 既存チームを削除して再作成
  await db.delete(schema.teams).where(eq(schema.teams.quiz_id, id));

  // 参加者の team_id を null にリセット
  await db
    .update(schema.participants)
    .set({ team_id: null })
    .where(eq(schema.participants.quiz_id, id));

  const values = body.teams.map((t, i) => ({
    quiz_id: id,
    name: t.name.trim(),
    order_index: i,
  }));

  const inserted = await db
    .insert(schema.teams)
    .values(values)
    .returning();

  return c.json(inserted.map((t) => ({ id: t.id, name: t.name, orderIndex: t.order_index })));
});

// チーム個別削除
quizRoutes.delete("/:id/teams/:teamId", async (c) => {
  const quizId = Number(c.req.param("id"));
  const teamId = Number(c.req.param("teamId"));

  const team = await db.query.teams.findFirst({
    where: and(
      eq(schema.teams.id, teamId),
      eq(schema.teams.quiz_id, quizId),
    ),
  });

  if (!team) {
    return c.json({ error: "チームが見つかりません" }, 404);
  }

  await db.delete(schema.teams).where(eq(schema.teams.id, teamId));
  return c.json({ success: true });
});

// クイズ削除（/:id は最も汎用的なので最後に定義）
quizRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));

  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, id),
  });

  if (!quiz) {
    return c.json({ error: "クイズが見つかりません" }, 404);
  }

  await db.delete(schema.quizzes).where(eq(schema.quizzes.id, id));
  return c.json({ success: true });
});

// 統計データ取得
quizRoutes.get("/:id/stats", async (c) => {
  const id = Number(c.req.param("id"));
  const { getQuizStats } = await import("../services/statsService.js");
  const stats = await getQuizStats(id);
  if (!stats) return c.json({ error: "クイズが見つかりません" }, 404);
  return c.json(stats);
});

// データエクスポート
quizRoutes.get("/:id/export", async (c) => {
  const id = Number(c.req.param("id"));
  const format = c.req.query("format") ?? "json";
  if (format !== "csv" && format !== "json") {
    return c.json({ error: "format は csv または json を指定してください" }, 400);
  }

  const { getExportData, buildCsv } = await import("../services/exportService.js");
  const data = await getExportData(id);
  if (!data) return c.json({ error: "クイズが見つかりません" }, 404);

  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = data.quiz.title.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim() || "quiz";
  const ext = format === "csv" ? "csv" : "json";
  const encodedName = encodeURIComponent(`${safeName}_${timestamp}.${ext}`);
  const disposition = `attachment; filename="quiz_${data.quiz.id}_${timestamp}.${ext}"; filename*=UTF-8''${encodedName}`;

  if (format === "csv") {
    const csv = buildCsv(data);
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", disposition);
    return c.body(csv);
  }

  c.header("Content-Type", "application/json; charset=utf-8");
  c.header("Content-Disposition", disposition);
  return c.body(JSON.stringify(data, null, 2));
});

// 全参加者一覧（クイズ情報付き）
// index.ts で /api/participants にマウント
export const participantRoutes = new Hono();

// 全参加者削除
participantRoutes.delete("/", async (c) => {
  const allParticipants = await db
    .select({ id: schema.participants.id })
    .from(schema.participants);

  if (allParticipants.length > 0) {
    await db.delete(schema.answers).where(
      inArray(schema.answers.participant_id, allParticipants.map((p) => p.id)),
    );
  }
  await db.delete(schema.participants);
  return c.json({ success: true });
});

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
