export const QuizStatus = {
  Draft: "draft",
  Lobby: "lobby",
  InProgress: "in_progress",
  Finished: "finished",
} as const;
export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

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

export type ParticipantInfo = {
  id: number;
  nickname: string;
  selfieUrl: string | null;
};

export type QuestionData = {
  questionId: number;
  questionIndex: number;
  totalQuestions: number;
  text: string;
  mediaType: MediaType;
  mediaUrl: string | null;
  mediaAltText?: string;
  choiceType: ChoiceType;
  choices: string[];
  choiceImageUrls: (string | null)[];
  timeLimitSeconds: number;
  points: number;
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

export type RankingData = {
  rankings: RankingEntry[];
};

export type FinalRankingEntry = RankingEntry & {
  correctCount: number;
  totalQuestions: number;
  averageResponseTimeMs: number;
  fastestResponseTimeMs: number;
};

export type FinalResultData = {
  rankings: FinalRankingEntry[];
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
  host_secret: string;
  questions?: Question[];
};

export type QuestionBankItem = {
  id: number;
  text: string;
  media_type: MediaType;
  media_url: string | null;
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
};
