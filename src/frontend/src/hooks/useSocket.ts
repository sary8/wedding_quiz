import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ParticipantInfo,
  TeamInfo,
  QuestionData,
  QuestionResultData,
  RankingData,
  FinalResultData,
  QuizStatus,
  RankingViewMode,
} from "../types";

type ServerToClientEvents = {
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
  reconnected: (data: {
    participantId: number;
    quizStatus: QuizStatus;
    currentQuestionData?: QuestionData | null;
    finalData?: FinalResultData | null;
    timerRemaining?: number;
    hasAnswered?: boolean;
  }) => void;
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
  rankingPageChanged: (data: { page: number; mode: RankingViewMode }) => void;
  showParticipantResults: () => void;
};

type ClientToServerEvents = {
  joinRoom: (
    data: { roomCode: string; nickname: string; selfieData?: string; token?: string; teamId?: number },
    cb: (res: { success: boolean; participantId?: number; token?: string; error?: string }) => void
  ) => void;
  submitAnswer: (
    data: { questionId: number; choiceIndex: number },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  openRoom: (
    data: { quizId: number; hostSecret: string },
    cb: (res: { success: boolean; roomCode?: string; error?: string }) => void
  ) => void;
  startGame: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  nextQuestion: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  closeQuestion: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  showRanking: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  endGame: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  watchRoom: (
    data: { roomCode: string },
    cb: (res: {
      success: boolean;
      error?: string;
      quizStatus?: QuizStatus;
      currentQuestionData?: QuestionData | null;
      timerRemaining?: number;
      finalData?: FinalResultData | null;
    }) => void
  ) => void;
  replayQuiz: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  closeGame: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  revealNextRank: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  setRankingPage: (
    data: { roomCode: string; hostSecret: string; page: number; mode: RankingViewMode },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
  showParticipantResults: (
    data: { roomCode: string; hostSecret: string },
    cb: (res: { success: boolean; error?: string }) => void
  ) => void;
};

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// socket.io の FallbackToUntypedListener が unknown[] を受け付けないため、
// on/off 呼び出し時にソケット自体を緩い型にキャストして回避する
type AnySocket = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // polling は WebSocket がプロキシ等で遮断された会場向けのフォールバック。
    // WebSocket が使える環境では自動アップグレードされるため常用されない
    const socket: TypedSocket = io(import.meta.env.VITE_API_URL || undefined, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", (err) => {
      setConnectionError(`接続エラー: ${err.message}`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      ...args: Parameters<ClientToServerEvents[E]>
    ) => {
      // Socket.io のジェネリック可変長引数は TypeScript が直接検証できないため unknown 経由でキャスト
      (socketRef.current?.emit as unknown as (...a: unknown[]) => void)?.(event, ...args);
    },
    []
  );

  const emitWithTimeout = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      data: Parameters<ClientToServerEvents[E]>[0],
      callback: Parameters<ClientToServerEvents[E]>[1],
      timeoutMs = 10000
    ) => {
      const socket = socketRef.current;
      if (!socket) {
        (callback as (res: { success: boolean; error?: string }) => void)({
          success: false,
          error: "サーバーに接続されていません",
        });
        return;
      }
      (socket.timeout(timeoutMs).emit as unknown as (...a: unknown[]) => void)(
        event,
        data,
        (err: Error | null, res: unknown) => {
          if (err) {
            (callback as (res: { success: boolean; error?: string }) => void)({
              success: false,
              error: "サーバーからの応答がタイムアウトしました",
            });
          } else {
            (callback as (res: unknown) => void)(res);
          }
        }
      );
    },
    []
  );

  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E]
    ) => {
      // 登録時のインスタンスをクロージャに捕捉する。クリーンアップ時に
      // socketRef.current を参照すると、インスタンスが入れ替わった場合に
      // 旧ソケットのリスナーが解除されず購読が重複する
      const socket = socketRef.current as unknown as AnySocket | null;
      socket?.on(event as string, handler as (...args: unknown[]) => void);
      return () => {
        socket?.off(event as string, handler as (...args: unknown[]) => void);
      };
    },
    []
  );

  return useMemo(
    () => ({ socket: socketRef, isConnected, connectionError, emit, emitWithTimeout, on }),
    [isConnected, connectionError, emit, emitWithTimeout, on],
  );
}
