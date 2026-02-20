import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import type {
  ParticipantInfo,
  QuestionData,
  QuestionResultData,
  RankingData,
  FinalResultData,
} from "../../types";
import { useGameSounds } from "../../hooks/useGameSounds";
import { LobbyPage } from "./LobbyPage";
import { QuestionPage } from "./QuestionPage";
import { ResultsPage } from "./ResultsPage";
import { RankingPage } from "./RankingPage";
import { FinalPage } from "./FinalPage";

type DisplayPhase = "lobby" | "countdown" | "question" | "results" | "ranking" | "final";

const NOOP = () => {}; // stable reference for display-only props

export function DisplayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { emit, on, isConnected, connectionError } = useSocket();
  const sounds = useGameSounds();

  const [phase, setPhase] = useState<DisplayPhase>("lobby");
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState(5);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("lobbyUpdate", (data) => setParticipants(data.participants)),
      on("gameStarted", () => {
        setCountdownValue(5);
        setPhase("countdown");
      }),
      on("participantJoined", (participant) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.id === participant.id)) return prev;
          return [...prev, participant];
        });
        sounds.playJoinChime();
      }),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setAnswerCount(0);
        setQuestionResult(null);
        setPhase("question");
        sounds.playQuestionStart();
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current);
          resultTimeoutRef.current = null;
        }
      }),
      on("timeUpdate", (data) => {
        setTimeRemaining(data.remaining);
        if (data.remaining <= 5 && data.remaining > 0) {
          sounds.playTick();
        }
      }),
      on("answerCountUpdate", (data) => setAnswerCount(data.count)),
      on("questionClosed", () => {
        sounds.playBuzzer();
        resultTimeoutRef.current = setTimeout(() => {
          setPhase("results");
        }, 5000);
      }),
      on("questionResult", (data) => {
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current);
          resultTimeoutRef.current = null;
        }
        setQuestionResult(data);
        setPhase("results");
        sounds.playResultReveal();
      }),
      on("rankingUpdate", (data) => {
        setRankingData(data);
        setPhase("ranking");
        sounds.playRankingFanfare();
      }),
      on("gameEnded", (data) => {
        setFinalData(data);
        setPhase("final");
        sounds.playDrumRoll();
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

  // カウントダウン表示（表示のみ、nextQuestionは呼ばない）
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdownValue <= 0) return;
    const timer = setTimeout(() => setCountdownValue((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdownValue]);

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
        <p className="text-sm text-gray-300">ページを再読み込みしてください</p>
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
            onStartGame={NOOP}
            isDisplay={true}
          />
        </>
      );
    case "countdown":
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white">
          <p className="text-2xl font-bold mb-4">ゲーム開始</p>
          <p className="text-[10rem] font-bold leading-none text-accent animate-pulse">
            {countdownValue > 0 ? countdownValue : ""}
          </p>
        </div>
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
            onCloseQuestion={NOOP}
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
            onShowRanking={NOOP}
            onNextQuestion={NOOP}
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
            onNextQuestion={NOOP}
            onEndGame={NOOP}
            isDisplay={true}
          />
        </>
      );
    case "final":
      return (
        <>
          {errorBanner}
          <FinalPage data={finalData} isDisplay={true} onSpotlight={sounds.playFanfare} />
        </>
      );
  }
}
