import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import type { QuestionData, QuestionResultData, FinalResultData } from "../../types";
import { uploadSelfie } from "../../services/api";
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

  // useRefで最新値を追跡し、useEffectの依存配列からhasAnsweredを除外
  const hasAnsweredRef = useRef(hasAnswered);
  hasAnsweredRef.current = hasAnswered;

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("gameStarted", () => setPhase("waiting")),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setHasAnswered(false);
        setQuestionResult(null);
        setPhase("answer");
      }),
      on("timeUpdate", (data) => setTimeRemaining(data.remaining)),
      on("questionClosed", () => {
        // 未回答の場合のみ結果画面へ遷移（questionResultが来ない可能性があるため）
        if (!hasAnsweredRef.current) {
          setPhase("result");
        }
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
  }, [on]);

  const handleJoin = useCallback(
    async (nickname: string, selfieData?: string) => {
      if (!roomCode) return;

      // 自撮りデータがあればアップロード
      let selfieFileName: string | undefined;
      if (selfieData) {
        try {
          const res = await uploadSelfie(selfieData);
          selfieFileName = res.filename;
        } catch {
          console.error("自撮りアップロード失敗");
        }
      }

      const token = localStorage.getItem(`quiz_token_${roomCode}`) || undefined;
      emit("joinRoom", { roomCode, nickname, selfieData: selfieFileName, token }, (res) => {
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

  // currentQuestion全体ではなくquestionIdのみ依存（rerender-dependencies）
  const questionId = currentQuestion?.questionId;
  const handleAnswer = useCallback(
    (choiceIndex: number) => {
      if (!questionId) return;
      setHasAnswered(true);
      emit("submitAnswer", { questionId, choiceIndex }, (res) => {
        if (!res.success) console.error(res.error);
      });
    },
    [questionId, emit]
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
