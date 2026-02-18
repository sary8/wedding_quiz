import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import type {
  ParticipantInfo,
  QuestionData,
  QuestionResultData,
  RankingData,
  FinalResultData,
} from "../../types";
import { LobbyPage } from "./LobbyPage";
import { QuestionPage } from "./QuestionPage";
import { ResultsPage } from "./ResultsPage";
import { RankingPage } from "./RankingPage";
import { FinalPage } from "./FinalPage";

type HostPhase = "lobby" | "question" | "results" | "ranking" | "final";

const NOOP = () => {}; // stable reference

export function HostPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const hostSecret = searchParams.get("key") || "";
  const quizId = Number(searchParams.get("quizId")) || 0;
  const { emit, on, isConnected, connectionError } = useSocket();

  const [phase, setPhase] = useState<HostPhase>("lobby");
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("lobbyUpdate", (data) => setParticipants(data.participants)),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setAnswerCount(0);
        setQuestionResult(null);
        setPhase("question");
      }),
      on("timeUpdate", (data) => setTimeRemaining(data.remaining)),
      on("answerCountUpdate", (data) => setAnswerCount(data.count)),
      on("questionClosed", NOOP),
      on("questionResult", (data) => {
        setQuestionResult(data);
        setPhase("results");
      }),
      on("rankingUpdate", (data) => {
        setRankingData(data);
        setPhase("ranking");
      }),
      on("gameEnded", (data) => {
        setFinalData(data);
        setPhase("final");
      }),
      on("quizReset", () => {
        setPhase("lobby");
        setCurrentQuestion(null);
        setTimeRemaining(0);
        setAnswerCount(0);
        setQuestionResult(null);
        setRankingData(null);
        setFinalData(null);
        setError(null);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  // ルーム開設（初回接続 + 再接続時に再実行してルームに再join）
  useEffect(() => {
    if (!isConnected || !roomCode) return;
    emit("openRoom", { quizId, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "ルームの開設に失敗しました");
    });

    // 再接続時にロビー参加者を再取得
    const unsub = on("lobbyUpdate", (data) => setParticipants(data.participants));
    emit("watchRoom", { roomCode }, () => {});
    return unsub;
  }, [isConnected, roomCode, quizId, hostSecret, emit, on]);

  // ゲーム開始 → 成功後に即 nextQuestion で最初の問題を配信
  const handleStartGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    emit("startGame", { roomCode, hostSecret }, (res) => {
      if (!res.success) {
        setError(res.error || "ゲームの開始に失敗しました");
        setIsProcessing(false);
        return;
      }
      // 開始成功 → 最初の問題を自動配信
      emit("nextQuestion", { roomCode, hostSecret }, (nextRes) => {
        setIsProcessing(false);
        if (!nextRes.success) {
          setError(nextRes.error || "最初の問題の配信に失敗しました");
        }
      });
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  const handleNextQuestion = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    emit("nextQuestion", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "問題の配信に失敗しました");
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  const handleCloseQuestion = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emit("closeQuestion", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "問題の締め切りに失敗しました");
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  const handleShowRanking = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emit("showRanking", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "ランキングの表示に失敗しました");
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  const handleEndGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emit("endGame", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "ゲーム終了に失敗しました");
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  const handleReplay = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emit("replayQuiz", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "リプレイに失敗しました");
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  if (!roomCode) return <div>ルームコードが不正です</div>;

  // 接続エラー表示
  if (connectionError) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white gap-4">
        <p className="text-xl text-red-400">{connectionError}</p>
        <p className="text-sm text-gray-400">ページを再読み込みしてください</p>
      </div>
    );
  }

  // エラーバナー
  const errorBanner = error ? (
    <button
      type="button"
      onClick={() => setError(null)}
      aria-label="エラーを閉じる"
      className="fixed top-0 left-0 right-0 px-6 py-3 bg-red-500 text-white text-sm text-center z-[1000] w-full border-none cursor-pointer hover:bg-red-600 transition-colors duration-200"
    >
      {error}（タップで閉じる）
    </button>
  ) : null;

  switch (phase) {
    case "lobby":
      return (
        <>
          {errorBanner}
          <LobbyPage
            roomCode={roomCode}
            participants={participants}
            onStartGame={handleStartGame}
          />
        </>
      );
    case "question":
      return (
        <>
          {errorBanner}
          <QuestionPage
            question={currentQuestion}
            timeRemaining={timeRemaining}
            answerCount={answerCount}
            totalParticipants={participants.length}
            onCloseQuestion={handleCloseQuestion}
          />
        </>
      );
    case "results":
      return (
        <>
          {errorBanner}
          <ResultsPage
            result={questionResult}
            question={currentQuestion}
            onShowRanking={handleShowRanking}
            onNextQuestion={handleNextQuestion}
          />
        </>
      );
    case "ranking":
      return (
        <>
          {errorBanner}
          <RankingPage
            data={rankingData}
            onNextQuestion={handleNextQuestion}
            onEndGame={handleEndGame}
          />
        </>
      );
    case "final":
      return (
        <>
          {errorBanner}
          <FinalPage data={finalData} onReplay={handleReplay} />
        </>
      );
  }
}
