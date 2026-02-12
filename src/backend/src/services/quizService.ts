import { db, schema } from "../db/index.js";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { calculateScore } from "./scoringService.js";
import type {
  ParticipantInfo,
  QuestionData,
  QuestionResultData,
  RankingEntry,
  FinalResultData,
} from "../types/index.js";

// ルーム認証
export async function verifyHostSecret(roomCode: string, hostSecret: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return null;
  if (quiz.host_secret !== hostSecret) return null;
  return quiz;
}

// ルーム開設 (draft/finished → lobby)
export async function openRoom(quizId: number, hostSecret: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz || quiz.host_secret !== hostSecret) return null;

  // in_progress中の再openを防止
  if (quiz.status !== "draft" && quiz.status !== "finished") return null;

  await db
    .update(schema.quizzes)
    .set({ status: "lobby" })
    .where(eq(schema.quizzes.id, quizId));

  return quiz.room_code;
}

// 参加者登録
export async function joinRoom(
  roomCode: string,
  nickname: string,
  selfieFileName: string | null,
  connectionId: string,
  existingToken?: string
) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return { error: "ルームが見つかりません" };
  if (quiz.status !== "lobby" && quiz.status !== "in_progress") {
    return { error: "このルームは現在参加できません" };
  }

  // 再接続チェック
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

  const token = nanoid(32);
  const result = await db
    .insert(schema.participants)
    .values({
      quiz_id: quiz.id,
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

  const participants = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.quiz_id, quiz.id));

  return participants.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
  }));
}

// ゲーム開始
export async function startGame(roomCode: string) {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz || quiz.status !== "lobby") return null;

  await db
    .update(schema.quizzes)
    .set({ status: "in_progress", current_question_index: -1 })
    .where(eq(schema.quizzes.id, quiz.id));

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

  await db
    .update(schema.quizzes)
    .set({ current_question_index: nextIndex })
    .where(eq(schema.quizzes.id, quiz.id));

  return {
    questionId: q.id,
    questionIndex: nextIndex,
    totalQuestions: questions.length,
    text: q.text,
    mediaType: q.media_type as "none" | "image" | "video",
    mediaUrl: q.media_url,
    choices: [q.choice1, q.choice2, q.choice3, q.choice4],
    timeLimitSeconds: q.time_limit_seconds,
    points: q.points,
  };
}

// 回答登録
export async function submitAnswer(
  participantId: number,
  questionId: number,
  choiceIndex: number,
  responseTimeMs: number
) {
  // 重複チェック
  const existing = await db.query.answers.findFirst({
    where: and(
      eq(schema.answers.question_id, questionId),
      eq(schema.answers.participant_id, participantId)
    ),
  });
  if (existing) return { error: "既に回答済みです" };

  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, questionId),
  });
  if (!question) return { error: "問題が見つかりません" };

  const isCorrect = choiceIndex === question.correct_choice;
  const scoreAwarded = calculateScore(isCorrect, responseTimeMs, question.time_limit_seconds);

  await db.insert(schema.answers).values({
    question_id: questionId,
    participant_id: participantId,
    choice_index: choiceIndex,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs,
    score_awarded: scoreAwarded,
  });

  // 累計スコア更新
  await db
    .update(schema.participants)
    .set({
      total_score: sql`${schema.participants.total_score} + ${scoreAwarded}`,
    })
    .where(eq(schema.participants.id, participantId));

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

// 問題結果生成
export async function getQuestionResult(
  questionId: number,
  participantId?: number
): Promise<QuestionResultData> {
  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, questionId),
  });
  if (!question) throw new Error("Question not found");

  // 回答分布
  const allAnswers = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.question_id, questionId));

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
  };

  // 参加者個別の結果
  if (participantId) {
    const myAnswer = allAnswers.find((a) => a.participant_id === participantId);
    if (myAnswer) {
      const participant = await db.query.participants.findFirst({
        where: eq(schema.participants.id, participantId),
      });
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

// ランキング計算・更新
export async function calculateRanking(roomCode: string): Promise<RankingEntry[]> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return [];

  const participants = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.quiz_id, quiz.id))
    .orderBy(desc(schema.participants.total_score));

  // 前回のランクを保持して比較用に
  const previousRanks = new Map(participants.map((p) => [p.id, p.current_rank]));

  // 現在の問題のresponse_timeを一括取得（N+1解消）
  const currentQuestionId = await getCurrentQuestionId(quiz.id, quiz.current_question_index);
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

  const rankings: RankingEntry[] = [];
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const rank = i + 1;

    // ランク更新
    await db
      .update(schema.participants)
      .set({ current_rank: rank })
      .where(eq(schema.participants.id, p.id));

    rankings.push({
      participantId: p.id,
      nickname: p.nickname,
      selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
      totalScore: p.total_score,
      rank,
      previousRank: previousRanks.get(p.id) || rank,
      lastResponseTimeMs: answerMap.get(p.id) ?? null,
    });
  }

  return rankings;
}

// 最終結果生成
export async function getFinalResult(roomCode: string): Promise<FinalResultData> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.room_code, roomCode),
  });
  if (!quiz) return { rankings: [] };

  const totalQuestions = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, quiz.id));

  const participants = await db
    .select()
    .from(schema.participants)
    .where(eq(schema.participants.quiz_id, quiz.id))
    .orderBy(desc(schema.participants.total_score));

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

  const rankings = [];
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
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
      rank: i + 1,
      previousRank: p.current_rank,
      lastResponseTimeMs: null,
      correctCount,
      totalQuestions: totalQuestions[0]?.count ?? 0,
      averageResponseTimeMs: Math.round(averageResponseTimeMs),
      fastestResponseTimeMs: Math.round(fastestResponseTimeMs),
    });
  }

  // ゲーム終了
  await db
    .update(schema.quizzes)
    .set({ status: "finished" })
    .where(eq(schema.quizzes.id, quiz.id));

  return { rankings };
}

// ヘルパー: 現在の問題ID取得
async function getCurrentQuestionId(
  quizId: number,
  currentQuestionIndex: number
): Promise<number | null> {
  if (currentQuestionIndex < 0) return null;
  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.quiz_id, quizId))
    .orderBy(asc(schema.questions.order_index));
  return questions[currentQuestionIndex]?.id ?? null;
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
