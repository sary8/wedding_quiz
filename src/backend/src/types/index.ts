// Quiz status
export const QuizStatus = {
  Draft: "draft",
  Lobby: "lobby",
  InProgress: "in_progress",
  Finished: "finished",
} as const;
export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

// Question type
export const QuestionType = {
  FourChoice: "four_choice",
  TrueFalse: "true_false",
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

// Choice type
export const ChoiceType = {
  Text: "text",
  Image: "image",
} as const;
export type ChoiceType = (typeof ChoiceType)[keyof typeof ChoiceType];

// Media type
export const MediaType = {
  None: "none",
  Image: "image",
  Video: "video",
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

// Socket.io server → client events
export type ServerToClientEvents = {
  participantJoined: (data: ParticipantInfo) => void;
  lobbyUpdate: (data: { participants: ParticipantInfo[]; teams?: TeamInfo[] }) => void;
  gameStarted: () => void;
  questionStarted: (data: QuestionData) => void;
  timeUpdate: (data: { remaining: number }) => void;
  answerCountUpdate: (data: { count: number }) => void;
  questionClosed: () => void;
  questionResult: (data: QuestionResultData) => void;
  rankingUpdate: (data: RankingData) => void;
  gameEnded: (data: FinalResultData) => void;
  error: (data: { message: string }) => void;
  reconnected: (data: { participantId: number; quizStatus: QuizStatus; currentQuestionData?: QuestionData | null; finalData?: FinalResultData | null }) => void;
  quizReset: () => void;
  hostReconnected: (data: {
    quizStatus: QuizStatus;
    currentQuestionIndex: number;
    participants: ParticipantInfo[];
    currentQuestionData?: QuestionData | null;
    answerCount?: number;
    timerRemaining?: number;
    finalData?: FinalResultData | null;
  }) => void;
  gameClosed: (data: { participants: ParticipantInfo[] }) => void;
  revealNextRank: () => void;
  rankingPageChanged: (data: { page: number; mode: "individual" | "team" }) => void;
};

// Socket.io client → server events
export type ClientToServerEvents = {
  // Participant
  joinRoom: (
    data: { roomCode: string; nickname: string; selfieData?: string; token?: string; teamId?: number },
    callback: (res: { success: boolean; participantId?: number; token?: string; error?: string }) => void
  ) => void;
  submitAnswer: (
    data: { questionId: number; choiceIndex: number },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  // Host
  openRoom: (
    data: { quizId: number; hostSecret: string },
    callback: (res: { success: boolean; roomCode?: string; error?: string }) => void
  ) => void;
  startGame: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  nextQuestion: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  closeQuestion: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  showRanking: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  endGame: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  watchRoom: (
    data: { roomCode: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  replayQuiz: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  closeGame: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  revealNextRank: (
    data: { roomCode: string; hostSecret: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
  setRankingPage: (
    data: { roomCode: string; hostSecret: string; page: number; mode: "individual" | "team" },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
};

// Team types
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

// Shared data types
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
  choiceType: ChoiceType;
  choices: string[];
  choiceImageUrls: (string | null)[];
  timeLimitSeconds: number;
  points: number;
  pointMultiplier: number;
};

export type QuestionResultData = {
  questionId: number;
  correctChoice: number; // 1-4
  distribution: number[]; // [count1, count2, count3, count4]
  // 参加者個別結果（参加者のみ受信）
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
  teamRankings?: TeamRankingEntry[];
  maxPossibleScore?: number;
};

export type FinalResultData = {
  rankings: (RankingEntry & {
    correctCount: number;
    totalQuestions: number;
    averageResponseTimeMs: number;
    fastestResponseTimeMs: number;
  })[];
  teamRankings?: TeamRankingEntry[];
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
