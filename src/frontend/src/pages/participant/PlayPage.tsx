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
  const [isJoining, setIsJoining] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  // useRefで最新値を追跡し、useEffectの依存配列からhasAnsweredを除外
  const hasAnsweredRef = useRef(hasAnswered);
  useEffect(() => {
    hasAnsweredRef.current = hasAnswered;
  });

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
        setIsJoining(false);
        if (data.quizStatus === "in_progress" && data.currentQuestionData) {
          // 出題中の問題がある場合は回答画面に復帰
          setCurrentQuestion(data.currentQuestionData);
          setHasAnswered(false);
          setPhase("answer");
        } else if (data.quizStatus === "lobby" || data.quizStatus === "in_progress") {
          setPhase("waiting");
        } else if (data.quizStatus === "finished") {
          setPhase("final");
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  const handleJoin = useCallback(
    async (nickname: string, selfieData?: string) => {
      if (!roomCode || isJoining) return;
      setIsJoining(true);

      // 自撮りデータがあればアップロード
      let selfieFileName: string | undefined;
      if (selfieData) {
        try {
          const res = await uploadSelfie(selfieData);
          selfieFileName = res.filename;
        } catch {
          setAnswerError("自撮りのアップロードに失敗しました。自撮りなしで参加します。");
        }
      }

      const token = localStorage.getItem(`quiz_token_${roomCode}`) || undefined;

      // タイムアウト: 10秒以内にサーバーから応答がなければエラー
      const joinTimeout = setTimeout(() => {
        setAnswerError("サーバーからの応答がありません。ページを再読み込みしてください。");
        setIsJoining(false);
      }, 10000);

      emit("joinRoom", { roomCode, nickname, selfieData: selfieFileName, token }, (res) => {
        clearTimeout(joinTimeout);
        if (res.success && res.participantId && res.token) {
          setParticipantId(res.participantId);
          localStorage.setItem(`quiz_token_${roomCode}`, res.token);
          setPhase("waiting");
        } else {
          setAnswerError(res.error || "参加に失敗しました");
          setIsJoining(false);
        }
      });
    },
    [roomCode, emit, isJoining]
  );

  // currentQuestion全体ではなくquestionIdのみ依存（rerender-dependencies）
  const questionId = currentQuestion?.questionId;

  const handleAnswer = useCallback(
    (choiceIndex: number) => {
      if (!questionId) return;
      setHasAnswered(true);
      setAnswerError(null);
      emit("submitAnswer", { questionId, choiceIndex }, (res) => {
        if (!res.success) {
          setAnswerError(res.error || "回答の送信に失敗しました");
          // 送信失敗時は再選択可能にする（ただし「既に回答済み」エラーの場合は維持）
          if (!res.error?.includes("既に回答済み")) {
            setHasAnswered(false);
          }
        }
      });
    },
    [questionId, emit]
  );

  if (!roomCode) return <div>ルームコードが不正です</div>;

  switch (phase) {
    case "profile":
      return (
        <>
          {answerError !== null ? (
            <button
              type="button"
              onClick={() => setAnswerError(null)}
              aria-label="エラーを閉じる"
              className="fixed top-0 left-0 right-0 px-4 py-3 bg-red-500 text-white text-sm text-center z-[1000] w-full border-none cursor-pointer hover:bg-red-600 transition-colors duration-200"
            >
              {answerError}（タップで閉じる）
            </button>
          ) : null}
          <ProfilePage onJoin={handleJoin} isJoining={isJoining} />
        </>
      );
    case "waiting":
      return <WaitingPage />;
    case "answer":
      return (
        <>
          {answerError !== null ? (
            <button
              type="button"
              onClick={() => setAnswerError(null)}
              aria-label="エラーを閉じる"
              className="fixed top-0 left-0 right-0 px-4 py-3 bg-red-500 text-white text-sm text-center z-[1000] w-full border-none cursor-pointer hover:bg-red-600 transition-colors duration-200"
            >
              {answerError}（タップで閉じる）
            </button>
          ) : null}
          <AnswerPage
            question={currentQuestion}
            timeRemaining={timeRemaining}
            hasAnswered={hasAnswered}
            onAnswer={handleAnswer}
          />
        </>
      );
    case "result":
      return <ResultPage result={questionResult} />;
    case "ranking":
      return <WaitingPage message="ランキング発表中..." />;
    case "final":
      return <ParticipantFinalPage data={finalData} participantId={participantId} />;
  }
}
