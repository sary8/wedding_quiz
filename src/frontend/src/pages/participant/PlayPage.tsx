import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import type { QuestionData, QuestionResultData, FinalResultData } from "../../types";
import { ProfilePage } from "./ProfilePage";
import { WaitingPage } from "./WaitingPage";
import { AnswerPage } from "./AnswerPage";
import { ResultPage } from "./ResultPage";
import { ParticipantFinalPage } from "./FinalPage";

type Phase = "profile" | "waiting" | "answer" | "result" | "ranking" | "final";

export function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { emit, on } = useSocket();

  const [phase, setPhase] = useState<Phase>("profile");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("gameStarted", () => setPhase("waiting")),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setHasAnswered(false);
        setPhase("answer");
      }),
      on("timeUpdate", (data) => setTimeRemaining(data.remaining)),
      on("questionClosed", () => {
        if (!hasAnswered) setPhase("result");
      }),
      on("questionResult", (data) => {
        setQuestionResult(data);
        setPhase("result");
      }),
      on("rankingUpdate", () => setPhase("ranking")),
      on("gameEnded", (data) => {
        setFinalData(data);
        setPhase("final");
      }),
      on("reconnected", (data) => {
        setParticipantId(data.participantId);
        if (data.quizStatus === "lobby") setPhase("waiting");
        else if (data.quizStatus === "in_progress") setPhase("waiting");
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, hasAnswered]);

  const handleJoin = useCallback(
    (nickname: string, selfieData?: string) => {
      if (!roomCode) return;
      const token = localStorage.getItem(`quiz_token_${roomCode}`) || undefined;
      emit("joinRoom", { roomCode, nickname, selfieData, token }, (res) => {
        if (res.success && res.participantId && res.token) {
          setParticipantId(res.participantId);
          localStorage.setItem(`quiz_token_${roomCode}`, res.token);
          setPhase("waiting");
        } else {
          alert(res.error || "参加に失敗しました");
        }
      });
    },
    [roomCode, emit]
  );

  const handleAnswer = useCallback(
    (choiceIndex: number) => {
      if (!currentQuestion) return;
      setHasAnswered(true);
      emit("submitAnswer", { questionId: currentQuestion.questionId, choiceIndex }, (res) => {
        if (!res.success) console.error(res.error);
      });
    },
    [currentQuestion, emit]
  );

  if (!roomCode) return <div>ルームコードが不正です</div>;

  switch (phase) {
    case "profile":
      return <ProfilePage onJoin={handleJoin} />;
    case "waiting":
      return <WaitingPage />;
    case "answer":
      return (
        <AnswerPage
          question={currentQuestion}
          timeRemaining={timeRemaining}
          hasAnswered={hasAnswered}
          onAnswer={handleAnswer}
        />
      );
    case "result":
      return <ResultPage result={questionResult} />;
    case "ranking":
      return <WaitingPage message="ランキング発表中..." />;
    case "final":
      return <ParticipantFinalPage data={finalData} participantId={participantId} />;
  }
}
