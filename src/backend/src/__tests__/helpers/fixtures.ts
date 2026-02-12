import { db, testSchema as schema } from "./testDb.js";

export async function createTestQuiz(overrides: Partial<{
  roomCode: string;
  hostSecret: string;
  title: string;
  status: string;
  currentQuestionIndex: number;
}> = {}) {
  const result = await db
    .insert(schema.quizzes)
    .values({
      room_code: overrides.roomCode ?? "ABCDEF",
      host_secret: overrides.hostSecret ?? "test-secret-123",
      title: overrides.title ?? "テストクイズ",
      status: (overrides.status as "draft" | "lobby" | "in_progress" | "finished") ?? "draft",
      current_question_index: overrides.currentQuestionIndex ?? -1,
      created_at: new Date().toISOString(),
    })
    .returning();
  return result[0];
}

export async function createTestQuestion(
  quizId: number,
  overrides: Partial<{
    orderIndex: number;
    text: string;
    choice1: string;
    choice2: string;
    choice3: string;
    choice4: string;
    correctChoice: number;
    timeLimitSeconds: number;
    points: number;
    mediaType: string;
    mediaUrl: string | null;
  }> = {}
) {
  const result = await db
    .insert(schema.questions)
    .values({
      quiz_id: quizId,
      order_index: overrides.orderIndex ?? 0,
      text: overrides.text ?? "テスト問題",
      media_type: (overrides.mediaType as "none" | "image" | "video") ?? "none",
      media_url: overrides.mediaUrl ?? null,
      choice1: overrides.choice1 ?? "選択肢1",
      choice2: overrides.choice2 ?? "選択肢2",
      choice3: overrides.choice3 ?? "選択肢3",
      choice4: overrides.choice4 ?? "選択肢4",
      correct_choice: overrides.correctChoice ?? 1,
      time_limit_seconds: overrides.timeLimitSeconds ?? 20,
      points: overrides.points ?? 1000,
    })
    .returning();
  return result[0];
}

export async function createTestParticipant(
  quizId: number,
  overrides: Partial<{
    nickname: string;
    selfieFileName: string | null;
    connectionId: string;
    token: string;
    totalScore: number;
    currentRank: number;
    isConnected: boolean;
  }> = {}
) {
  const result = await db
    .insert(schema.participants)
    .values({
      quiz_id: quizId,
      nickname: overrides.nickname ?? "テストユーザー",
      selfie_file_name: overrides.selfieFileName ?? null,
      connection_id: overrides.connectionId ?? "test-connection",
      token: overrides.token ?? `token-${Date.now()}-${Math.random().toString(36)}`,
      total_score: overrides.totalScore ?? 0,
      current_rank: overrides.currentRank ?? 0,
      is_connected: overrides.isConnected ?? true,
      joined_at: new Date().toISOString(),
    })
    .returning();
  return result[0];
}

export async function createTestAnswer(overrides: {
  questionId: number;
  participantId: number;
  choiceIndex: number;
  isCorrect: boolean;
  responseTimeMs: number;
  scoreAwarded?: number;
}) {
  const result = await db
    .insert(schema.answers)
    .values({
      question_id: overrides.questionId,
      participant_id: overrides.participantId,
      choice_index: overrides.choiceIndex,
      is_correct: overrides.isCorrect,
      response_time_ms: overrides.responseTimeMs,
      score_awarded: overrides.scoreAwarded ?? 0,
      answered_at: new Date().toISOString(),
    })
    .returning();
  return result[0];
}
