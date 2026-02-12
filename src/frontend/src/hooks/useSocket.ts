import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ParticipantInfo,
  QuestionData,
  QuestionResultData,
  RankingData,
  FinalResultData,
  QuizStatus,
} from "../types";

type ServerToClientEvents = {
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
  reconnected: (data: { participantId: number; quizStatus: QuizStatus }) => void;
};

type ClientToServerEvents = {
  joinRoom: (
    data: { roomCode: string; nickname: string; selfieData?: string; token?: string },
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
};

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const socket: TypedSocket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
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
      socketRef.current?.emit(event, ...args as any);
    },
    []
  );

  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E]
    ) => {
      socketRef.current?.on(event, handler as any);
      return () => {
        socketRef.current?.off(event, handler as any);
      };
    },
    []
  );

  return { socket: socketRef, isConnected, connectionError, emit, on };
}
