import { db, schema } from "../db/index.js";
import { eq, asc, desc } from "drizzle-orm";
import type {
  QuestionStats,
  ParticipantStatsEntry,
  QuizStatsData,
  Difficulty,
  QuestionType,
} from "../types/index.js";

function getDifficulty(correctRate: number): Difficulty {
  if (correctRate >= 75) return "easy";
  if (correctRate >= 50) return "normal";
  if (correctRate >= 25) return "hard";
  return "very_hard";
}

export async function getQuizStats(quizId: number): Promise<QuizStatsData | null> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz) return null;

  // 問題・参加者・回答を並列取得
  const [questions, participants, allAnswers] = await Promise.all([
    db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.quiz_id, quizId))
      .orderBy(asc(schema.questions.order_index)),
    db
      .select({
        id: schema.participants.id,
        nickname: schema.participants.nickname,
        selfie_file_name: schema.participants.selfie_file_name,
        total_score: schema.participants.total_score,
        team_id: schema.participants.team_id,
        team_name: schema.teams.name,
      })
      .from(schema.participants)
      .leftJoin(schema.teams, eq(schema.participants.team_id, schema.teams.id))
      .where(eq(schema.participants.quiz_id, quizId))
      .orderBy(desc(schema.participants.total_score)),
    db
      .select()
      .from(schema.answers)
      .innerJoin(schema.questions, eq(schema.answers.question_id, schema.questions.id))
      .where(eq(schema.questions.quiz_id, quizId)),
  ]);

  const totalParticipants = participants.length;

  // 回答をquestionId別にグループ化
  const answersByQuestion = new Map<number, typeof allAnswers>();
  for (const row of allAnswers) {
    const qId = row.answers.question_id;
    const list = answersByQuestion.get(qId) ?? [];
    list.push(row);
    answersByQuestion.set(qId, list);
  }

  // 回答をparticipantId別にグループ化
  const answersByParticipant = new Map<number, typeof allAnswers>();
  for (const row of allAnswers) {
    const pId = row.answers.participant_id;
    const list = answersByParticipant.get(pId) ?? [];
    list.push(row);
    answersByParticipant.set(pId, list);
  }

  // 問題別統計
  const questionStats: QuestionStats[] = questions.map((q) => {
    const answers = answersByQuestion.get(q.id) ?? [];
    const totalAnswers = answers.length;
    const correctCount = answers.filter((a) => a.answers.is_correct).length;
    const correctRate = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
    const avgTime = totalAnswers > 0
      ? Math.round(answers.reduce((sum, a) => sum + a.answers.response_time_ms, 0) / totalAnswers)
      : 0;

    const isTrueFalse = q.question_type === "true_false";
    const maxChoices = isTrueFalse ? 2 : 4;
    const distribution = Array.from({ length: maxChoices }, (_, i) =>
      answers.filter((a) => a.answers.choice_index === i + 1).length
    );

    return {
      questionId: q.id,
      orderIndex: q.order_index,
      text: q.text,
      questionType: q.question_type as QuestionType,
      correctChoice: q.correct_choice,
      pointMultiplier: q.point_multiplier,
      totalAnswers,
      correctCount,
      correctRate,
      averageResponseTimeMs: avgTime,
      distribution,
      noAnswerCount: totalParticipants - totalAnswers,
      difficulty: getDifficulty(correctRate),
    };
  });

  // 問題IDの順序マップ（scoreProgress計算用）
  const questionOrder = questions.map((q) => q.id);

  // 参加者別統計
  const participantStats: ParticipantStatsEntry[] = participants.map((p, i) => {
    const answers = answersByParticipant.get(p.id) ?? [];
    const correctCount = answers.filter((a) => a.answers.is_correct).length;
    const totalAttempted = answers.length;
    const correctRate = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
    const times = answers.map((a) => a.answers.response_time_ms);
    const avgTime = times.length > 0
      ? Math.round(times.reduce((s, t) => s + t, 0) / times.length)
      : 0;
    const fastestTime = times.length > 0 ? Math.round(Math.min(...times)) : 0;

    // スコア推移: 問題順に累計スコア
    const scoreByQuestion = new Map<number, number>();
    for (const a of answers) {
      scoreByQuestion.set(a.answers.question_id, a.answers.score_awarded);
    }
    let cumulative = 0;
    const scoreProgress = questionOrder.map((qId) => {
      cumulative += scoreByQuestion.get(qId) ?? 0;
      return cumulative;
    });

    return {
      participantId: p.id,
      nickname: p.nickname,
      selfieUrl: p.selfie_file_name ? `/api/media/${p.selfie_file_name}` : null,
      teamName: p.team_name,
      totalScore: p.total_score,
      rank: i + 1,
      correctCount,
      correctRate,
      averageResponseTimeMs: avgTime,
      fastestResponseTimeMs: fastestTime,
      scoreProgress,
    };
  });

  return {
    quizId: quiz.id,
    title: quiz.title,
    createdAt: quiz.created_at,
    teamMode: quiz.team_mode,
    totalParticipants,
    totalQuestions: questions.length,
    questionStats,
    participantStats,
  };
}
