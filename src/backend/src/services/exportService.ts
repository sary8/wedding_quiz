import { db, schema } from "../db/index.js";
import { eq, asc, desc } from "drizzle-orm";

type ExportData = {
  quiz: {
    id: number;
    title: string;
    status: string;
    teamMode: boolean;
    createdAt: string;
  };
  questions: {
    orderIndex: number;
    text: string;
    questionType: string;
    choiceType: string;
    choices: (string | null)[];
    correctChoice: number;
    timeLimitSeconds: number;
    points: number;
    pointMultiplier: number;
  }[];
  participants: {
    nickname: string;
    teamName: string | null;
    totalScore: number;
    rank: number;
    correctCount: number;
  }[];
  answers: {
    nickname: string;
    questionIndex: number;
    questionText: string;
    choiceIndex: number;
    isCorrect: boolean;
    responseTimeMs: number;
    scoreAwarded: number;
  }[];
};

export async function getExportData(quizId: number): Promise<ExportData | null> {
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz) return null;

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
        total_score: schema.participants.total_score,
        team_name: schema.teams.name,
      })
      .from(schema.participants)
      .leftJoin(schema.teams, eq(schema.participants.team_id, schema.teams.id))
      .where(eq(schema.participants.quiz_id, quizId))
      .orderBy(desc(schema.participants.total_score)),
    db
      .select({
        participant_id: schema.answers.participant_id,
        question_id: schema.answers.question_id,
        choice_index: schema.answers.choice_index,
        is_correct: schema.answers.is_correct,
        response_time_ms: schema.answers.response_time_ms,
        score_awarded: schema.answers.score_awarded,
      })
      .from(schema.answers)
      .innerJoin(schema.questions, eq(schema.answers.question_id, schema.questions.id))
      .where(eq(schema.questions.quiz_id, quizId)),
  ]);

  // 参加者IDマップ
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  // 問題IDマップ
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // 正答数の集計
  const correctCounts = new Map<number, number>();
  for (const a of allAnswers) {
    if (a.is_correct) {
      correctCounts.set(a.participant_id, (correctCounts.get(a.participant_id) ?? 0) + 1);
    }
  }

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      teamMode: quiz.team_mode,
      createdAt: quiz.created_at,
    },
    questions: questions.map((q) => ({
      orderIndex: q.order_index,
      text: q.text,
      questionType: q.question_type,
      choiceType: q.choice_type,
      choices: [q.choice1, q.choice2, q.choice3, q.choice4],
      correctChoice: q.correct_choice,
      timeLimitSeconds: q.time_limit_seconds,
      points: q.points,
      pointMultiplier: q.point_multiplier,
    })),
    participants: participants.map((p, i) => ({
      nickname: p.nickname,
      teamName: p.team_name,
      totalScore: p.total_score,
      rank: i + 1,
      correctCount: correctCounts.get(p.id) ?? 0,
    })),
    answers: allAnswers
      .map((a) => {
        const participant = participantMap.get(a.participant_id);
        const question = questionMap.get(a.question_id);
        if (!participant || !question) return null;
        return {
          nickname: participant.nickname,
          questionIndex: question.order_index,
          questionText: question.text,
          choiceIndex: a.choice_index,
          isCorrect: a.is_correct,
          responseTimeMs: Math.round(a.response_time_ms),
          scoreAwarded: a.score_awarded,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .sort((a, b) => a.nickname.localeCompare(b.nickname) || a.questionIndex - b.questionIndex),
  };
}

function escapeCsv(value: string): string {
  let v = value;
  if (/^[=+\-@]/.test(v)) {
    v = "'" + v;
  }
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function buildCsv(data: ExportData): string {
  const BOM = "\uFEFF";
  const lines: string[] = [];

  // セクション1: クイズ情報
  lines.push("# クイズ情報");
  lines.push(["ID", "タイトル", "ステータス", "チームモード", "作成日時"].join(","));
  lines.push([
    String(data.quiz.id),
    escapeCsv(data.quiz.title),
    data.quiz.status,
    data.quiz.teamMode ? "ON" : "OFF",
    data.quiz.createdAt,
  ].join(","));
  lines.push("");

  // セクション2: 問題データ
  lines.push("# 問題データ");
  lines.push(["番号", "問題文", "形式", "選択肢1", "選択肢2", "選択肢3", "選択肢4", "正解", "制限時間(秒)", "ポイント", "倍率"].join(","));
  for (const q of data.questions) {
    lines.push([
      String(q.orderIndex + 1),
      escapeCsv(q.text),
      q.questionType === "true_false" ? "○×" : "4択",
      escapeCsv(q.choices[0] ?? ""),
      escapeCsv(q.choices[1] ?? ""),
      escapeCsv(q.choices[2] ?? ""),
      escapeCsv(q.choices[3] ?? ""),
      String(q.correctChoice),
      String(q.timeLimitSeconds),
      String(q.points),
      String(q.pointMultiplier),
    ].join(","));
  }
  lines.push("");

  // セクション3: 参加者情報
  lines.push("# 参加者情報");
  const pHeader = data.quiz.teamMode
    ? ["順位", "ニックネーム", "チーム", "スコア", "正答数"]
    : ["順位", "ニックネーム", "スコア", "正答数"];
  lines.push(pHeader.join(","));
  for (const p of data.participants) {
    const row = data.quiz.teamMode
      ? [String(p.rank), escapeCsv(p.nickname), escapeCsv(p.teamName ?? ""), String(p.totalScore), String(p.correctCount)]
      : [String(p.rank), escapeCsv(p.nickname), String(p.totalScore), String(p.correctCount)];
    lines.push(row.join(","));
  }
  lines.push("");

  // セクション4: 回答履歴
  lines.push("# 回答履歴");
  lines.push(["ニックネーム", "問題番号", "問題文", "選択番号", "正誤", "回答時間(ms)", "獲得ポイント"].join(","));
  for (const a of data.answers) {
    lines.push([
      escapeCsv(a.nickname),
      String(a.questionIndex + 1),
      escapeCsv(a.questionText),
      String(a.choiceIndex),
      a.isCorrect ? "正解" : "不正解",
      String(a.responseTimeMs),
      String(a.scoreAwarded),
    ].join(","));
  }

  return BOM + lines.join("\r\n");
}
