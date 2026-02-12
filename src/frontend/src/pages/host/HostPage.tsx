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
  const { emit, on, isConnected } = useSocket();

  const [phase, setPhase] = useState<HostPhase>("lobby");
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("lobbyUpdate", (data) => setParticipants(data.participants)),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setAnswerCount(0);
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
      if (!res.success) console.error(res.error);
    });
  }, [isConnected, roomCode, hostSecret, emit]);

  const handleStartGame = useCallback(() => {
    if (!roomCode) return;
    emit("startGame", { roomCode, hostSecret }, (res) => {
      if (!res.success) console.error(res.error);
    });
  }, [roomCode, hostSecret, emit]);

  const handleNextQuestion = useCallback(() => {
    if (!roomCode) return;
    emit("nextQuestion", { roomCode, hostSecret }, (res) => {
      if (!res.success) alert(res.error);
    });
  }, [roomCode, hostSecret, emit]);

  const handleCloseQuestion = useCallback(() => {
    if (!roomCode) return;
    emit("closeQuestion", { roomCode, hostSecret }, (res) => {
      if (!res.success) console.error(res.error);
    });
  }, [roomCode, hostSecret, emit]);

  const handleShowRanking = useCallback(() => {
    if (!roomCode) return;
    emit("showRanking", { roomCode, hostSecret }, (res) => {
      if (!res.success) console.error(res.error);
    });
  }, [roomCode, hostSecret, emit]);

  const handleEndGame = useCallback(() => {
    if (!roomCode) return;
    emit("endGame", { roomCode, hostSecret }, (res) => {
      if (!res.success) console.error(res.error);
    });
  }, [roomCode, hostSecret, emit]);

  if (!roomCode) return <div>ルームコードが不正です</div>;

  switch (phase) {
    case "lobby":
      return (
        <LobbyPage
          roomCode={roomCode}
          participants={participants}
          onStartGame={handleStartGame}
        />
      );
    case "question":
      return (
        <QuestionPage
          question={currentQuestion}
          timeRemaining={timeRemaining}
          answerCount={answerCount}
          totalParticipants={participants.length}
          onCloseQuestion={handleCloseQuestion}
        />
      );
    case "results":
      return (
        <ResultsPage
          result={questionResult}
          onShowRanking={handleShowRanking}
          onNextQuestion={handleNextQuestion}
        />
      );
    case "ranking":
      return (
        <RankingPage
          data={rankingData}
          onNextQuestion={handleNextQuestion}
          onEndGame={handleEndGame}
        />
      );
    case "final":
      return <FinalPage data={finalData} />;
  }
}
