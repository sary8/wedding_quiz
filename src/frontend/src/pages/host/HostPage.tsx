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
      on("questionClosed", () => {}),
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
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  // ルーム開設
  useEffect(() => {
    if (!isConnected || !roomCode) return;
    emit("openRoom", { quizId, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "ルームの開設に失敗しました");
    });
  }, [isConnected, roomCode, quizId, hostSecret, emit]);

  // ゲーム開始 → 成功後に即 nextQuestion で最初の問題を配信
  const handleStartGame = useCallback(() => {
    if (!roomCode) return;
    setError(null);
    emit("startGame", { roomCode, hostSecret }, (res) => {
      if (!res.success) {
        setError(res.error || "ゲームの開始に失敗しました");
        return;
      }
      // 開始成功 → 最初の問題を自動配信
      emit("nextQuestion", { roomCode, hostSecret }, (nextRes) => {
        if (!nextRes.success) {
          setError(nextRes.error || "最初の問題の配信に失敗しました");
        }
      });
    });
  }, [roomCode, hostSecret, emit]);

  const handleNextQuestion = useCallback(() => {
    if (!roomCode) return;
    setError(null);
    emit("nextQuestion", { roomCode, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "問題の配信に失敗しました");
    });
  }, [roomCode, hostSecret, emit]);

  const handleCloseQuestion = useCallback(() => {
    if (!roomCode) return;
    emit("closeQuestion", { roomCode, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "問題の締め切りに失敗しました");
    });
  }, [roomCode, hostSecret, emit]);

  const handleShowRanking = useCallback(() => {
    if (!roomCode) return;
    emit("showRanking", { roomCode, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "ランキングの表示に失敗しました");
    });
  }, [roomCode, hostSecret, emit]);

  const handleEndGame = useCallback(() => {
    if (!roomCode) return;
    emit("endGame", { roomCode, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "ゲーム終了に失敗しました");
    });
  }, [roomCode, hostSecret, emit]);

  if (!roomCode) return <div>ルームコードが不正です</div>;

  // 接続エラー表示
  if (connectionError) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e", color: "#fff", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 20, color: "#ef5350" }}>{connectionError}</p>
        <p style={{ fontSize: 14, color: "#aaa" }}>ページを再読み込みしてください</p>
      </div>
    );
  }

  // エラーバナー
  const errorBanner = error ? (
    <button
      onClick={() => setError(null)}
      aria-label="エラーを閉じる"
      style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#ef5350", color: "#fff", textAlign: "center", fontSize: 14, zIndex: 1000, width: "100%", border: "none", cursor: "pointer" }}
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
          <FinalPage data={finalData} />
        </>
      );
  }
}
