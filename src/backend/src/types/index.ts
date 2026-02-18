// Quiz status
export const QuizStatus = {
  Draft: "draft",
  Lobby: "lobby",
  InProgress: "in_progress",
  Finished: "finished",
} as const;
export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

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
  lobbyUpdate: (data: { participants: ParticipantInfo[] }) => void;
  gameStarted: () => void;
  questionStarted: (data: QuestionData) => void;
  timeUpdate: (data: { remaining: number }) => void;
  answerCountUpdate: (data: { count: number }) => void;
  questionClosed: () => void;
  questionResult: (data: QuestionResultData) => void;
  rankingUpdate: (data: RankingData) => void;
  gameEnded: (data: FinalResultData) => void;
  error: (data: { message: string }) => void;
  reconnected: (data: { participantId: number; quizStatus: QuizStatus; currentQuestionData?: QuestionData | null }) => void;
  quizReset: () => void;
};

// Socket.io client → server events
export type ClientToServerEvents = {
  // Participant
  joinRoom: (
    data: { roomCode: string; nickname: string; selfieData?: string; token?: string },
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
};

// Shared data types
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
  choices: string[];
  timeLimitSeconds: number;
  points: number;
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
};

export type FinalResultData = {
  rankings: (RankingEntry & {
    correctCount: number;
    totalQuestions: number;
    averageResponseTimeMs: number;
    fastestResponseTimeMs: number;
  })[];
};
