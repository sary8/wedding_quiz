export const QuizStatus = {
  Draft: "draft",
  Lobby: "lobby",
  InProgress: "in_progress",
  Finished: "finished",
} as const;
export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

export const QuestionType = {
  FourChoice: "four_choice",
  TrueFalse: "true_false",
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const ChoiceType = {
  Text: "text",
  Image: "image",
} as const;
export type ChoiceType = (typeof ChoiceType)[keyof typeof ChoiceType];

export const MediaType = {
  None: "none",
  Image: "image",
  Video: "video",
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export type TeamInfo = {
  id: number;
  name: string;
  orderIndex: number;
};

export type TeamRankingEntry = {
  teamId: number;
  teamName: string;
  totalScore: number;
  memberCount: number;
  rank: number;
  previousRank?: number;
};

export type ParticipantInfo = {
  id: number;
  nickname: string;
  selfieUrl: string | null;
  teamId?: number | null;
  teamName?: string | null;
};

export type QuestionData = {
  questionId: number;
  questionIndex: number;
  totalQuestions: number;
  text: string;
  questionType: QuestionType;
  mediaType: MediaType;
  mediaUrl: string | null;
  mediaAltText?: string;
  choiceType: ChoiceType;
  choices: string[];
  choiceImageUrls: (string | null)[];
  timeLimitSeconds: number;
  points: number;
  pointMultiplier: number;
};

export type QuestionResultData = {
  questionId: number;
  correctChoice: number;
  distribution: number[];
  yourAnswer?: {
    choiceIndex: number;
    isCorrect: boolean;
    scoreAwarded: number;
    responseTimeMs: number;
    currentRank: number;
    totalScore: number;
  };
};

export type RankingEntry = {
  participantId: number;
  nickname: string;
  selfieUrl: string | null;
  totalScore: number;
  rank: number;
  previousRank: number;
  lastResponseTimeMs: number | null;
};

// 問題別ランキングエントリ
export type QuestionRankingEntry = {
  participantId: number;
  nickname: string;
  selfieUrl: string | null;
  scoreAwarded: number;
  responseTimeMs: number | null;
  rank: number;
};

// 問題別チームランキングエントリ
export type QuestionTeamRankingEntry = {
  teamId: number;
  teamName: string;
  totalScore: number;
  memberCount: number;
  rank: number;
};

// 問題別ランキングデータ
export type QuestionRankingData = {
  questionIndex: number;
  questionText: string;
  maxQuestionScore: number;
  rankings: QuestionRankingEntry[];
  teamRankings?: QuestionTeamRankingEntry[];
};

export type RankingData = {
  rankings: RankingEntry[];
  teamRankings?: TeamRankingEntry[];
  maxPossibleScore?: number;
  questionRanking?: QuestionRankingData;
};

// ランキング表示モード
export const RankingViewMode = {
  Individual: "individual",
  Team: "team",
  QuestionIndividual: "questionIndividual",
  QuestionTeam: "questionTeam",
} as const;
export type RankingViewMode = (typeof RankingViewMode)[keyof typeof RankingViewMode];

export type FinalRankingEntry = RankingEntry & {
  correctCount: number;
  totalQuestions: number;
  averageResponseTimeMs: number;
  fastestResponseTimeMs: number;
};

export type FinalResultData = {
  rankings: FinalRankingEntry[];
  teamRankings?: TeamRankingEntry[];
};

export type QuizSummary = {
  id: number;
  room_code: string;
  title: string;
  status: QuizStatus;
  current_question_index: number;
  created_at: string;
  question_count: number;
  participant_count: number;
};

export type ParticipantSummary = {
  id: number;
  nickname: string;
  selfie_file_name: string | null;
  total_score: number;
  current_rank: number;
  joined_at: string;
};

export type ParticipantWithQuiz = {
  id: number;
  nickname: string;
  selfie_file_name: string | null;
  total_score: number;
  quiz_id: number;
  quiz_title: string;
  joined_at: string;
};

export type Quiz = QuizSummary & {
  host_secret?: string;
  team_mode?: boolean;
  teams?: TeamInfo[];
  questions?: Question[];
};

export type QuestionBankItem = {
  id: number;
  text: string;
  media_type: MediaType;
  media_url: string | null;
  question_type: QuestionType;
  choice_type: ChoiceType;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  choice1_image_url: string | null;
  choice2_image_url: string | null;
  choice3_image_url: string | null;
  choice4_image_url: string | null;
  correct_choice: number;
  time_limit_seconds: number;
  points: number;
  point_multiplier: number;
  created_at: string;
};

export type Question = {
  id: number;
  quiz_id: number;
  order_index: number;
  text: string;
  media_type: MediaType;
  media_url: string | null;
  media_alt_text?: string;
  question_type: QuestionType;
  choice_type: ChoiceType;
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  choice1_image_url: string | null;
  choice2_image_url: string | null;
  choice3_image_url: string | null;
  choice4_image_url: string | null;
  correct_choice: number;
  time_limit_seconds: number;
  points: number;
  point_multiplier: number;
};

// 難易度
export const Difficulty = {
  Easy: "easy",
  Normal: "normal",
  Hard: "hard",
  VeryHard: "very_hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

// 統計データ型
export type QuestionStats = {
  questionId: number;
  orderIndex: number;
  text: string;
  questionType: QuestionType;
  correctChoice: number;
  pointMultiplier: number;
  totalAnswers: number;
  correctCount: number;
  correctRate: number;
  averageResponseTimeMs: number;
  distribution: number[];
  noAnswerCount: number;
  difficulty: Difficulty;
};

export type ParticipantStatsEntry = {
  participantId: number;
  nickname: string;
  selfieUrl: string | null;
  teamName: string | null;
  totalScore: number;
  rank: number;
  correctCount: number;
  correctRate: number;
  averageResponseTimeMs: number;
  fastestResponseTimeMs: number;
  scoreProgress: number[];
};

export type QuizStatsData = {
  quizId: number;
  title: string;
  createdAt: string;
  teamMode: boolean;
  totalParticipants: number;
  totalQuestions: number;
  questionStats: QuestionStats[];
  participantStats: ParticipantStatsEntry[];
};
