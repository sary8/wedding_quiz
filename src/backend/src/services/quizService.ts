import { db, schema } from "../db/index.js";
import { eq, and, asc, desc, sql, inArray, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calculateScore } from "./scoringService.js";
import { deleteMediaFile } from "../routes/media.js";
import { safeCompare } from "../utils/safeCompare.js";
import type {
  ParticipantInfo,
  TeamInfo,
  TeamRankingEntry,
  QuestionData,
  QuestionResultData,
  RankingEntry,
  RankingData,
  FinalResultData,
  QuestionRankingEntry,
  QuestionTeamRankingEntry,
  QuestionRankingData,
} from "../types/index.js";

// 終盤5問（最後の5問）は順位を非表示にする。
// 総問題数が5以下なら全問が対象。
export function isRankingHidden(currentQuestionIndex: number, totalQuestions: number): boolean {
  return currentQuestionIndex >= totalQuestions - 5;
}

// ルーム認証
export async function verifyHostSecret(roomCode: string, hostSecret: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return null;
  if (!safeCompare(quiz.host_secret, hostSecret)) return null;
  return quiz;
}

// ルーム開設 (draft/finished → lobby, lobby/in_progress → そのまま返却)
export async function openRoom(quizId: number, hostSecret: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz || !safeCompare(quiz.host_secret, hostSecret)) return null;

  if (quiz.status === "lobby" || quiz.status === "in_progress") {
    return quiz.room_code;
  }

  if (quiz.status !== "draft" && quiz.status !== "finished") return null;

  await db
    .update(schema.quizzes)
    .set({ status: "lobby", finished_at: null })
    .where(eq(schema.quizzes.id, quizId));

  return quiz.room_code;
}

// 参加者登録
export async function joinRoom(
  roomCode: string,
  nickname: string,
  selfieFileName: string | null,
  connectionId: string,
  existingToken?: string,
  teamId?: number
) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return { error: "ルームが見つかりません" };
  if (quiz.status !== "lobby" && quiz.status !== "in_progress") {
    return { error: "このルームは現在参加できません" };
  }

  // 再接続チェック（teamIdバリデーションより先に実行: 再接続時はteamId不要）
  if (existingToken) {
    const existing = await db.query.participants.findFirst({
      where: and(
        eq(schema.participants.token, existingToken),
        eq(schema.participants.quiz_id, quiz.id)
      ),
    });
    if (existing) {
      await db
        .update(schema.participants)
        .set({ connection_id: connectionId, is_connected: true })
        .where(eq(schema.participants.id, existing.id));
      return { participant: { id: existing.id, token: existing.token }, reconnect: true };
    }
  }

  // team_mode ON 時のバリデーション（新規参加のみ）
  if (quiz.team_mode && teamId == null) {
    return { error: "チームモードではチームの選択が必須です" };
  }
  if (quiz.team_mode && teamId != null) {
    const team = await db.query.teams.findFirst({
      where: and(
        eq(schema.teams.id, teamId),
        eq(schema.teams.quiz_id, quiz.id)
      ),
    });
    if (!team) {
      return { error: "指定されたチームが見つかりません" };
    }
  }

  // ニックネーム長さチェック（サービス側でも防御的に検証）
  if (nickname.trim().length > 8) {
    return { error: "ニックネームは8文字以内で入力してください" };
  }

  // ニックネーム重複チェック
  const existingNickname = await db.query.participants.findFirst({
    where: and(
      eq(schema.participants.quiz_id, quiz.id),
      eq(schema.participants.nickname, nickname.trim())
    ),
  });
  if (existingNickname) {
    return { error: "このニックネームはすでに使われています" };
  }

  const token = nanoid(32);
  const result = await db
    .insert(schema.participants)
    .values({
      quiz_id: quiz.id,
      team_id: (quiz.team_mode && teamId != null) ? teamId : null,
      nickname: nickname.trim(),
      selfie_file_name: selfieFileName,
      connection_id: connectionId,
      token,
      is_connected: true,
    })
    .returning();

  return { participant: { id: result[0].id, token: result[0].token }, reconnect: false };
}

// 切断処理
export async function handleDisconnect(connectionId: string) {
  await db
    .update(schema.participants)
    .set({ is_connected: false })
    .where(eq(schema.participants.connection_id, connectionId));
}

// ロビー参加者一覧
export async function getLobbyParticipants(roomCode: string): Promise<ParticipantInfo[]> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return [];

  const rows = await db
    .select({
      id: schema.participants.id,
      nickname: schema.participants.nickname,
      selfie_file_name: schema.participants.selfie_file_name,
      team_id: schema.participants.team_id,
      team_name: schema.teams.name,
    })
    .from(schema.participants)
    .leftJoin(schema.teams, eq(schema.participants.team_id, schema.teams.id))
    .where(eq(schema.participants.quiz_id, quiz.id));

  return rows.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
    teamId: p.team_id,
    teamName: p.team_name,
  }));
}

// ゲーム開始（冪等: 既にin_progressの場合はそのまま成功を返す）
export async function startGame(roomCode: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return null;

  // 既にin_progressなら冪等に成功を返す
  if (quiz.status === "in_progress") return quiz.id;
  if (quiz.status !== "lobby") return null;

  await db
    .update(schema.quizzes)
    .set({ status: "in_progress", current_question_index: -1 })
    .where(
      and(
        eq(schema.quizzes.id, quiz.id),
        eq(schema.quizzes.status, "lobby")
      )
    );

  return quiz.id;
}

// 次の問題を取得
export async function getNextQuestion(roomCode: string): Promise<QuestionData | null> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz || quiz.status !== "in_progress") return null;

  const nextIndex = quiz.current_question_index + 1;

  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, quiz.id))
    .orderBy(asc(schema.questions.order_index));

  if (nextIndex >= questions.length) return null;

  const q = questions[nextIndex];

  // 楽観ロック: 読み取り時のインデックスから変わっていない場合のみ進める。
  // 無条件UPDATEだと二重実行でインデックスが2進み、問題が1つスキップされる
  const updated = await db
    .update(schema.quizzes)
    .set({ current_question_index: nextIndex, active_question_started_at: Date.now() })
    .where(
      and(
        eq(schema.quizzes.id, quiz.id),
        eq(schema.quizzes.current_question_index, quiz.current_question_index)
      )
    )
    .returning({ id: schema.quizzes.id });
  if (updated.length === 0) return null;

  return buildQuestionData(q, nextIndex, questions.length);
}

// 回答登録（トランザクションで重複チェック→INSERT→スコア更新を一括実行）
export async function submitAnswer(
  participantId: number,
  questionId: number,
  choiceIndex: number,
  responseTimeMs: number
) {
  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, questionId),
  });
  if (!question) return { error: "問題が見つかりません" };

  // 問題タイプに応じた選択肢数バリデーション
  const maxChoice = question.question_type === "true_false" ? 2 : 4;
  if (choiceIndex < 1 || choiceIndex > maxChoice) {
    return { error: "不正な選択肢です" };
  }

  const isCorrect = choiceIndex === question.correct_choice;
  const scoreAwarded = calculateScore(isCorrect, responseTimeMs, question.time_limit_seconds, question.point_multiplier);

  try {
    await db.batch([
      db.insert(schema.answers).values({
        question_id: questionId,
        participant_id: participantId,
        choice_index: choiceIndex,
        is_correct: isCorrect,
        response_time_ms: responseTimeMs,
        score_awarded: scoreAwarded,
      }),
      db
        .update(schema.participants)
        .set({
          total_score: sql`${schema.participants.total_score} + ${scoreAwarded}`,
        })
        .where(eq(schema.participants.id, participantId)),
    ]);
  } catch (e) {
    const err = e as Error;
    if (err.message?.includes("UNIQUE constraint failed")) {
      return { error: "既に回答済みです" };
    }
    throw e;
  }

  return { isCorrect, scoreAwarded };
}

// 問題の回答数取得
export async function getAnswerCount(questionId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.answers)
    .where(eq(schema.answers.question_id, questionId));
  return result[0]?.count ?? 0;
}

// 参加者が指定問題に回答済みか（再接続時の状態復元用）
export async function hasParticipantAnswered(
  participantId: number,
  questionId: number
): Promise<boolean> {
  const row = await db.query.answers.findFirst({
    where: and(
      eq(schema.answers.participant_id, participantId),
      eq(schema.answers.question_id, questionId)
    ),
  });
  return !!row;
}

// 問題結果生成
export async function getQuestionResult(
  questionId: number,
  participantId?: number
): Promise<QuestionResultData> {
  // question, allAnswers, participant を並列取得
  const [question, allAnswers, participant] = await Promise.all([
    db.query.questions.findFirst({
      where: eq(schema.questions.id, questionId),
    }),
    db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.question_id, questionId)),
    participantId
      ? db.query.participants.findFirst({
          where: eq(schema.participants.id, participantId),
        })
      : Promise.resolve(undefined),
  ]);
  if (!question) throw new Error("Question not found");

  // クイズの総問題数を取得（終盤ブラックアウト判定用）
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, question.quiz_id));
  const totalQuestions = countResult[0]?.count ?? 0;

  // 回答分布
  const distribution = [0, 0, 0, 0];
  for (const a of allAnswers) {
    if (a.choice_index >= 1 && a.choice_index <= 4) {
      distribution[a.choice_index - 1]++;
    }
  }

  const result: QuestionResultData = {
    questionId,
    correctChoice: question.correct_choice,
    distribution,
    hideRanking: isRankingHidden(question.order_index, totalQuestions),
  };

  // 参加者個別の結果
  if (participantId) {
    const myAnswer = allAnswers.find((a) => a.participant_id === participantId);
    if (myAnswer) {
      result.yourAnswer = {
        choiceIndex: myAnswer.choice_index,
        isCorrect: myAnswer.is_correct,
        scoreAwarded: myAnswer.score_awarded,
        responseTimeMs: myAnswer.response_time_ms,
        currentRank: participant?.current_rank ?? 0,
        totalScore: participant?.total_score ?? 0,
      };
    }
  }

  return result;
}

// 問題結果一括生成（N+1クエリ削減）
export async function getQuestionResultBatch(
  questionId: number,
  participantIds: number[]
): Promise<Map<number, QuestionResultData>> {
  const [question, allAnswers, allParticipants] = await Promise.all([
    db.query.questions.findFirst({
      where: eq(schema.questions.id, questionId),
    }),
    db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.question_id, questionId)),
    participantIds.length > 0
      ? db
          .select()
          .from(schema.participants)
          .where(
            sql`${schema.participants.id} IN (${sql.join(participantIds.map((id) => sql`${id}`), sql`, `)})`
          )
      : Promise.resolve([]),
  ]);
  if (!question) throw new Error("Question not found");

  // クイズの総問題数を取得（終盤ブラックアウト判定用）
  const batchCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, question.quiz_id));
  const totalQuestions = batchCountResult[0]?.count ?? 0;
  const hideRanking = isRankingHidden(question.order_index, totalQuestions);

  const distribution = [0, 0, 0, 0];
  for (const a of allAnswers) {
    if (a.choice_index >= 1 && a.choice_index <= 4) {
      distribution[a.choice_index - 1]++;
    }
  }

  const participantMap = new Map(allParticipants.map((p) => [p.id, p]));
  const resultMap = new Map<number, QuestionResultData>();

  for (const pid of participantIds) {
    const result: QuestionResultData = {
      questionId,
      correctChoice: question.correct_choice,
      distribution,
      hideRanking,
    };
    const myAnswer = allAnswers.find((a) => a.participant_id === pid);
    if (myAnswer) {
      const participant = participantMap.get(pid);
      result.yourAnswer = {
        choiceIndex: myAnswer.choice_index,
        isCorrect: myAnswer.is_correct,
        scoreAwarded: myAnswer.score_awarded,
        responseTimeMs: myAnswer.response_time_ms,
        currentRank: participant?.current_rank ?? 0,
        totalScore: participant?.total_score ?? 0,
      };
    }
    resultMap.set(pid, result);
  }

  return resultMap;
}

// チームランキング計算
export async function calculateTeamRanking(quizId: number): Promise<TeamRankingEntry[]> {
  const rows = await db
    .select({
      teamId: schema.teams.id,
      teamName: schema.teams.name,
      totalScore: sql<number>`COALESCE(SUM(${schema.participants.total_score}), 0)`,
      memberCount: sql<number>`COUNT(${schema.participants.id})`,
    })
    .from(schema.teams)
    .leftJoin(schema.participants, eq(schema.teams.id, schema.participants.team_id))
    .where(eq(schema.teams.quiz_id, quizId))
    .groupBy(schema.teams.id)
    .orderBy(desc(sql`COALESCE(SUM(${schema.participants.total_score}), 0)`));

  return rows.map((r, i) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    totalScore: r.totalScore,
    memberCount: r.memberCount,
    rank: i + 1,
  }));
}

// 問題別個人ランキング計算
export async function calculateQuestionRanking(
  quizId: number,
  questionId: number
): Promise<QuestionRankingEntry[]> {
  const participants = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.quiz_id, quizId));

  const answers = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.question_id, questionId));

  const answerMap = new Map(answers.map((a) => [a.participant_id, a]));

  const entries: QuestionRankingEntry[] = participants.map((p) => {
    const answer = answerMap.get(p.id);
    return {
      participantId: p.id,
      nickname: p.nickname,
      selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
      scoreAwarded: answer?.score_awarded ?? 0,
      responseTimeMs: answer?.response_time_ms ?? null,
      rank: 0,
    };
  });

  // score_awarded DESC, response_time_ms ASC (nullは末尾)
  entries.sort((a, b) => {
    if (a.scoreAwarded !== b.scoreAwarded) return b.scoreAwarded - a.scoreAwarded;
    if (a.responseTimeMs == null && b.responseTimeMs == null) return 0;
    if (a.responseTimeMs == null) return 1;
    if (b.responseTimeMs == null) return -1;
    return a.responseTimeMs - b.responseTimeMs;
  });

  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

// 問題別チームランキング計算
export async function calculateQuestionTeamRanking(
  quizId: number,
  questionId: number
): Promise<QuestionTeamRankingEntry[]> {
  const rows = await db
    .select({
      teamId: schema.teams.id,
      teamName: schema.teams.name,
      totalScore: sql<number>`COALESCE(SUM(${schema.answers.score_awarded}), 0)`,
      memberCount: sql<number>`COUNT(DISTINCT ${schema.participants.id})`,
    })
    .from(schema.teams)
    .leftJoin(schema.participants, eq(schema.teams.id, schema.participants.team_id))
    .leftJoin(
      schema.answers,
      and(
        eq(schema.answers.participant_id, schema.participants.id),
        eq(schema.answers.question_id, questionId)
      )
    )
    .where(eq(schema.teams.quiz_id, quizId))
    .groupBy(schema.teams.id)
    .orderBy(desc(sql`COALESCE(SUM(${schema.answers.score_awarded}), 0)`));

  return rows.map((r, i) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    totalScore: r.totalScore,
    memberCount: r.memberCount,
    rank: i + 1,
  }));
}

// チーム一覧取得
export async function getTeams(quizId: number): Promise<TeamInfo[]> {
  const rows = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.quiz_id, quizId))
    .orderBy(asc(schema.teams.order_index));

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    orderIndex: t.order_index,
  }));
}

// ランキング計算・更新
export async function calculateRanking(roomCode: string): Promise<RankingData> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return { rankings: [] };

  // participants, currentQuestionId, 満点スコアを並列取得
  const [participants, currentQuestionId, maxScoreRows] = await Promise.all([
    db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.quiz_id, quiz.id))
      .orderBy(desc(schema.participants.total_score)),
    getCurrentQuestionId(quiz.id, quiz.current_question_index),
    db
      .select({ total: sql<number>`COALESCE(SUM(points * point_multiplier), 0)` })
      .from(schema.questions)
      .where(
        and(
          eq(schema.questions.quiz_id, quiz.id),
          lte(schema.questions.order_index, quiz.current_question_index)
        )
      ),
  ]);
  const maxPossibleScore = maxScoreRows[0]?.total ?? 0;

  // 前回のランクを保持して比較用に
  const previousRanks = new Map(participants.map((p) => [p.id, p.current_rank]));

  // 現在の問題のresponse_timeを一括取得（N+1解消）
  const answerMap = new Map<number, number>();
  if (currentQuestionId) {
    const answers = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.question_id, currentQuestionId));
    for (const a of answers) {
      answerMap.set(a.participant_id, a.response_time_ms);
    }
  }

  // Dense ranking（同スコアは同順位）
  const ranks: number[] = [];
  let currentRank = 1;
  for (let i = 0; i < participants.length; i++) {
    if (i > 0 && participants[i].total_score < participants[i - 1].total_score) {
      currentRank = i + 1;
    }
    ranks.push(currentRank);
  }

  // ランク更新をバッチ実行
  const rankUpdates = participants.map((p, i) =>
    db
      .update(schema.participants)
      .set({ current_rank: ranks[i] })
      .where(eq(schema.participants.id, p.id))
  );
  if (rankUpdates.length > 0) {
    await db.batch(rankUpdates as [typeof rankUpdates[0], ...typeof rankUpdates]);
  }

  const rankings: RankingEntry[] = participants.map((p, i) => ({
    participantId: p.id,
    nickname: p.nickname,
    selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
    totalScore: p.total_score,
    rank: ranks[i],
    previousRank: previousRanks.get(p.id) || ranks[i],
    lastResponseTimeMs: answerMap.get(p.id) ?? null,
  }));

  const result: RankingData = { rankings, maxPossibleScore };

  // チームモードの場合はチームランキングも計算
  if (quiz.team_mode) {
    result.teamRankings = await calculateTeamRanking(quiz.id);
  }

  // 問題別ランキングを計算
  if (currentQuestionId) {
    const question = await db.query.questions.findFirst({
      where: eq(schema.questions.id, currentQuestionId),
    });
    if (question) {
      const qRankings = await calculateQuestionRanking(quiz.id, currentQuestionId);
      const questionRanking: QuestionRankingData = {
        questionIndex: quiz.current_question_index,
        questionText: question.text,
        maxQuestionScore: question.points * question.point_multiplier,
        rankings: qRankings,
      };
      if (quiz.team_mode) {
        questionRanking.teamRankings = await calculateQuestionTeamRanking(quiz.id, currentQuestionId);
      }
      result.questionRanking = questionRanking;
    }
  }

  return result;
}

// 最終結果生成
export async function getFinalResult(roomCode: string): Promise<FinalResultData> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return { rankings: [] };

  // totalQuestions と participants を並列取得
  const [totalQuestions, participants] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.questions)
      .where(eq(schema.questions.quiz_id, quiz.id)),
    db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.quiz_id, quiz.id))
      .orderBy(desc(schema.participants.total_score)),
  ]);

  // 全参加者の回答を一括取得（N+1解消）
  const participantIds = participants.map((p) => p.id);
  const allAnswers = participantIds.length > 0
    ? await db
        .select()
        .from(schema.answers)
        .where(
          sql`${schema.answers.participant_id} IN (${sql.join(participantIds.map((id) => sql`${id}`), sql`, `)})`
        )
    : [];

  // participantId → answers のマップ
  const answersMap = new Map<number, typeof allAnswers>();
  for (const a of allAnswers) {
    const list = answersMap.get(a.participant_id) ?? [];
    list.push(a);
    answersMap.set(a.participant_id, list);
  }

  // Dense ranking（同スコアは同順位）
  const rankings = [];
  let finalRank = 1;
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (i > 0 && p.total_score < participants[i - 1].total_score) {
      finalRank = i + 1;
    }
    const answers = answersMap.get(p.id) ?? [];

    const correctCount = answers.filter((a) => a.is_correct).length;
    const responseTimes = answers.map((a) => a.response_time_ms);
    const averageResponseTimeMs =
      responseTimes.length > 0
        ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
        : 0;
    const fastestResponseTimeMs =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;

    rankings.push({
      participantId: p.id,
      nickname: p.nickname,
      selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
      totalScore: p.total_score,
      rank: finalRank,
      previousRank: p.current_rank,
      lastResponseTimeMs: null,
      correctCount,
      totalQuestions: totalQuestions[0]?.count ?? 0,
      averageResponseTimeMs: Math.round(averageResponseTimeMs),
      fastestResponseTimeMs: Math.round(fastestResponseTimeMs),
    });
  }

  // ゲーム終了（既にfinishedならfinished_atを上書きしない）
  if (quiz.status !== "finished") {
    await db
      .update(schema.quizzes)
      .set({ status: "finished", finished_at: new Date().toISOString() })
      .where(eq(schema.quizzes.id, quiz.id));
  }

  const result: FinalResultData = { rankings };

  // チームモードの場合はチームランキングも計算
  if (quiz.team_mode) {
    result.teamRankings = await calculateTeamRanking(quiz.id);
  }

  return result;
}

// リプレイ（ゲームリセット）
export async function replayQuiz(quizId: number, hostSecret: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz || !safeCompare(quiz.host_secret, hostSecret)) return { error: "認証エラー" };
  if (quiz.status !== "finished") return { error: "終了済みのクイズのみリプレイできます" };

  const questionRows = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, quizId));
  const questionIds = questionRows.map((q) => q.id);

  const ops = [];

  if (questionIds.length > 0) {
    ops.push(
      db.delete(schema.answers).where(inArray(schema.answers.question_id, questionIds))
    );
  }

  ops.push(
    db
      .update(schema.participants)
      .set({ total_score: 0, current_rank: 0 })
      .where(eq(schema.participants.quiz_id, quizId))
  );

  ops.push(
    db
      .update(schema.quizzes)
      .set({ status: "lobby", current_question_index: -1, finished_at: null, active_question_started_at: null })
      .where(eq(schema.quizzes.id, quizId))
  );

  if (ops.length > 0) {
    await db.batch(ops as [typeof ops[0], ...typeof ops]);
  }

  return { success: true };
}

// ヘルパー: DB行からQuestionDataを構築
function buildQuestionData(
  q: {
    id: number;
    text: string;
    question_type: string;
    media_type: string;
    media_url: string | null;
    choice_type: string;
    choice1: string;
    choice2: string;
    choice3: string | null;
    choice4: string | null;
    choice1_image_url: string | null;
    choice2_image_url: string | null;
    choice3_image_url: string | null;
    choice4_image_url: string | null;
    time_limit_seconds: number;
    points: number;
    point_multiplier: number;
  },
  questionIndex: number,
  totalQuestions: number
): QuestionData {
  const isTrueFalse = q.question_type === "true_false";
  const choices = isTrueFalse
    ? [q.choice1, q.choice2]
    : [q.choice1, q.choice2, q.choice3 ?? "", q.choice4 ?? ""];
  const choiceImageUrls = isTrueFalse
    ? [q.choice1_image_url, q.choice2_image_url]
    : [q.choice1_image_url, q.choice2_image_url, q.choice3_image_url, q.choice4_image_url];

  return {
    questionId: q.id,
    questionIndex,
    totalQuestions,
    text: q.text,
    questionType: q.question_type as "four_choice" | "true_false",
    mediaType: q.media_type as "none" | "image" | "video",
    mediaUrl: q.media_url,
    choiceType: q.choice_type as "text" | "image",
    choices,
    choiceImageUrls,
    timeLimitSeconds: q.time_limit_seconds,
    points: q.points,
    pointMultiplier: q.point_multiplier,
  };
}

// ヘルパー: 現在の問題ID取得（order_indexで直接検索）
async function getCurrentQuestionId(
  quizId: number,
  currentQuestionIndex: number
): Promise<number | null> {
  if (currentQuestionIndex < 0) return null;
  const result = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.quiz_id, quizId),
        eq(schema.questions.order_index, currentQuestionIndex)
      )
    )
    .limit(1);
  return result[0]?.id ?? null;
}

// 再接続時の問題データ取得
export async function getReconnectQuestionData(
  quizId: number,
  currentQuestionIndex: number
): Promise<QuestionData | null> {
  if (currentQuestionIndex < 0) return null;

  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, quizId))
    .orderBy(asc(schema.questions.order_index));

  if (currentQuestionIndex >= questions.length) return null;
  const q = questions[currentQuestionIndex];

  return buildQuestionData(q, currentQuestionIndex, questions.length);
}

// 出題中フラグ（開始時刻）をクリアする。締切・タイマー満了時に呼ぶ。
export async function clearActiveQuestion(roomCode: string): Promise<void> {
  await db
    .update(schema.quizzes)
    .set({ active_question_started_at: null })
    .where(eq(schema.quizzes.room_code, roomCode));
}

// プロセス再起動で揮発した「中断中の出題」をDBの開始時刻から復元するための情報を返す。
// in_progress かつ active_question_started_at が非nullのときのみ中断問題ありと判定する。
export async function getInterruptedQuestion(roomCode: string): Promise<{
  questionId: number;
  questionData: QuestionData;
  remainingSeconds: number;
} | null> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz || quiz.status !== "in_progress" || quiz.active_question_started_at == null) return null;
  const questionData = await getReconnectQuestionData(quiz.id, quiz.current_question_index);
  if (!questionData) return null;
  const elapsedSec = (Date.now() - quiz.active_question_started_at) / 1000;
  const remainingSeconds = Math.max(0, Math.ceil(questionData.timeLimitSeconds - elapsedSec));
  return { questionId: questionData.questionId, questionData, remainingSeconds };
}

// quizIdからroomCode取得
export async function getQuizByRoom(roomCode: string) {
  return db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
}

// participantIdからparticipant取得
export async function getParticipant(participantId: number) {
  return db.query.participants.findFirst({
    where: eq(schema.participants.id, participantId),
  });
}

// クイズ完全削除（DB + メディアファイル）
export async function deleteQuizCompletely(quizId: number): Promise<boolean> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz) return false;

  const [participantsWithSelfie, questionsWithMedia] = await Promise.all([
    db
      .select({ selfie_file_name: schema.participants.selfie_file_name })
      .from(schema.participants)
      .where(eq(schema.participants.quiz_id, quizId)),
    db
      .select({
        media_url: schema.questions.media_url,
        choice1_image_url: schema.questions.choice1_image_url,
        choice2_image_url: schema.questions.choice2_image_url,
        choice3_image_url: schema.questions.choice3_image_url,
        choice4_image_url: schema.questions.choice4_image_url,
      })
      .from(schema.questions)
      .where(eq(schema.questions.quiz_id, quizId)),
  ]);

  await db.delete(schema.quizzes).where(eq(schema.quizzes.id, quizId));

  const deletePromises: Promise<void>[] = [];
  for (const p of participantsWithSelfie) {
    deletePromises.push(deleteMediaFile(p.selfie_file_name));
  }
  for (const q of questionsWithMedia) {
    deletePromises.push(deleteMediaFile(q.media_url));
    deletePromises.push(deleteMediaFile(q.choice1_image_url));
    deletePromises.push(deleteMediaFile(q.choice2_image_url));
    deletePromises.push(deleteMediaFile(q.choice3_image_url));
    deletePromises.push(deleteMediaFile(q.choice4_image_url));
  }
  await Promise.all(deletePromises);

  return true;
}
