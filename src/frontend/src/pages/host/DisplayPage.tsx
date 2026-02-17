import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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

type DisplayPhase = "lobby" | "question" | "results" | "ranking" | "final";

export function DisplayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { emit, on, isConnected, connectionError } = useSocket();

  const [phase, setPhase] = useState<DisplayPhase>("lobby");
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
      on("participantJoined", (participant) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.id === participant.id)) return prev;
          return [...prev, participant];
        });
      }),
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

  // watchRoom でルームに参加（read-only）
  useEffect(() => {
    if (!isConnected || !roomCode) return;
    emit("watchRoom", { roomCode }, (res) => {
      if (!res.success) setError(res.error || "ルームへの接続に失敗しました");
    });
  }, [isConnected, roomCode, emit]);

  if (!roomCode) return <div>ルームコードが不正です</div>;

  if (connectionError) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white gap-4">
        <p className="text-xl text-red-400">{connectionError}</p>
        <p className="text-sm text-gray-400">ページを再読み込みしてください</p>
      </div>
    );
  }

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
            onStartGame={() => {}}
            isDisplay={true}
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
            onCloseQuestion={() => {}}
            isDisplay={true}
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
            onShowRanking={() => {}}
            onNextQuestion={() => {}}
            isDisplay={true}
          />
        </>
      );
    case "ranking":
      return (
        <>
          {errorBanner}
          <RankingPage
            data={rankingData}
            onNextQuestion={() => {}}
            onEndGame={() => {}}
            isDisplay={true}
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
