import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import type { QuestionData, QuestionResultData, RankingData, FinalResultData, ParticipantInfo, TeamInfo } from "../../types";
import { uploadSelfie, getRoomInfo, deleteMyParticipantData } from "../../services/api";
import { ProfilePage } from "./ProfilePage";
import { WaitingPage } from "./WaitingPage";
import { AnswerPage } from "./AnswerPage";
import { ResultPage } from "./ResultPage";
import { ParticipantRankingPage } from "./ParticipantRankingPage";
import { ParticipantFinalPage } from "./FinalPage";
import { ThankYouScreen } from "../host/ThankYouScreen";

type Phase = "profile" | "waiting" | "answer" | "result" | "ranking" | "final" | "closed";

export function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { emit, on, isConnected } = useSocket();

  const [phase, setPhase] = useState<Phase>("profile");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [closedParticipants, setClosedParticipants] = useState<ParticipantInfo[]>([]);
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [roomTeams, setRoomTeams] = useState<TeamInfo[] | undefined>(undefined);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [myDataDeleted, setMyDataDeleted] = useState(false);

  // ルーム情報取得（存在チェック + チームモード判定）
  useEffect(() => {
    if (!roomCode) return;
    let ignore = false;
    getRoomInfo(roomCode)
      .then((info) => {
        if (!ignore && info.teamMode && info.teams.length > 0) {
          setRoomTeams(info.teams);
        }
      })
      .catch(() => {
        if (!ignore) setRoomNotFound(true);
      });
    return () => { ignore = true; };
  }, [roomCode]);

  // useRefで最新値を追跡し、useEffectの依存配列からhasAnsweredを除外
  const hasAnsweredRef = useRef(hasAnswered);
  useEffect(() => {
    hasAnsweredRef.current = hasAnswered;
  });

  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("gameStarted", () => setPhase("waiting")),
      on("answerCountUpdate", (data) => setAnswerCount(data.count)),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setHasAnswered(false);
        setQuestionResult(null);
        setAnswerCount(0);
        setPhase("answer");
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current);
          resultTimeoutRef.current = null;
        }
      }),
      on("timeUpdate", (data) => setTimeRemaining(Math.max(0, data.remaining))),
      on("questionClosed", () => {
        if (!hasAnsweredRef.current) {
          // 未回答の場合は即座に結果画面へ遷移
          setPhase("result");
        } else {
          // 回答済みの場合: 3秒以内にquestionResultが届かなければ自動遷移
          resultTimeoutRef.current = setTimeout(() => {
            setPhase("result");
          }, 3000);
        }
      }),
      on("questionResult", (data) => {
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current);
          resultTimeoutRef.current = null;
        }
        setQuestionResult(data);
        setPhase("result");
      }),
      on("rankingUpdate", (data) => {
        setRankingData(data);
        setPhase("ranking");
      }),
      on("gameEnded", (data) => {
        setFinalData(data);
        setResultsRevealed(false);
        setPhase("final");
      }),
      on("showParticipantResults", () => {
        setResultsRevealed(true);
      }),
      on("quizReset", () => {
        setPhase("waiting");
        setCurrentQuestion(null);
        setTimeRemaining(0);
        setHasAnswered(false);
        setQuestionResult(null);
        setRankingData(null);
        setFinalData(null);
        setResultsRevealed(false);
        setAnswerCount(0);
      }),
      on("reconnected", (data) => {
        setParticipantId(data.participantId);
        setIsJoining(false);
        if (data.quizStatus === "in_progress" && data.currentQuestionData) {
          setCurrentQuestion(data.currentQuestionData);
          // タイマー残り時間と回答済み状態をサーバーから復元する。
          // hasAnsweredをfalse固定にすると回答済みの参加者に回答ボタンが再表示される
          setTimeRemaining(data.timerRemaining ?? 0);
          setHasAnswered(data.hasAnswered ?? false);
          setPhase("answer");
        } else if (data.quizStatus === "lobby" || data.quizStatus === "in_progress") {
          setPhase("waiting");
        } else if (data.quizStatus === "finished") {
          if (data.finalData) {
            setFinalData(data.finalData);
          }
          setResultsRevealed(true);
          setPhase("final");
        }
      }),
      on("gameClosed", (data) => {
        setClosedParticipants(data.participants);
        setPhase("closed");
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  const handleJoin = useCallback(
    async (nickname: string, selfieData?: string, teamId?: number) => {
      if (!roomCode || isJoining) return;
      setIsJoining(true);

      // 自撮りデータがあればアップロード
      let selfieFileName: string | undefined;
      if (selfieData) {
        try {
          const res = await uploadSelfie(selfieData, roomCode);
          selfieFileName = res.filename;
        } catch {
          setAnswerError("自撮りのアップロードに失敗しました。自撮りなしで参加します。");
        }
      }

      const token = sessionStorage.getItem(`quiz_token_${roomCode}`) || undefined;

      // タイムアウト: 10秒以内にサーバーから応答がなければエラー
      const joinTimeout = setTimeout(() => {
        setAnswerError("サーバーからの応答がありません。ページを再読み込みしてください。");
        setIsJoining(false);
      }, 10000);

      emit("joinRoom", { roomCode, nickname, selfieData: selfieFileName, token, teamId }, (res) => {
        clearTimeout(joinTimeout);
        if (res.success && res.participantId && res.token) {
          setParticipantId(res.participantId);
          sessionStorage.setItem(`quiz_token_${roomCode}`, res.token);
          setPhase("waiting");
        } else {
          setAnswerError(res.error || "参加に失敗しました");
          setIsJoining(false);
        }
      });
    },
    [roomCode, emit, isJoining]
  );

  // 自身のデータ削除（プライバシーポリシー記載の自己データ削除）
  const handleDeleteMyData = useCallback(async () => {
    if (!roomCode) return;
    const token = sessionStorage.getItem(`quiz_token_${roomCode}`);
    if (!token) {
      setAnswerError("削除用のトークンが見つかりません");
      return;
    }
    try {
      await deleteMyParticipantData(token);
      sessionStorage.removeItem(`quiz_token_${roomCode}`);
      setMyDataDeleted(true);
    } catch (e) {
      setAnswerError(e instanceof Error ? e.message : "データの削除に失敗しました");
    }
  }, [roomCode]);

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
          setHasAnswered(false);
        }
      });
    },
    [questionId, emit]
  );

  if (!roomCode) return <div>ルームコードが不正です</div>;

  if (roomNotFound) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-blush px-6">
        <h2 className="font-script text-3xl text-primary mb-4 [text-wrap:balance]">ルームが見つかりません</h2>
        <p className="text-sage-text/70 text-center mb-6">ルームコード「{roomCode}」は存在しないか、既に終了しています。</p>
        <a
          href="/"
          className="px-8 py-3 rounded-xl bg-primary text-white text-base font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px]"
        >
          トップに戻る
        </a>
      </div>
    );
  }

  const disconnectBanner = !isConnected && phase !== "profile" ? (
    <div role="alert" className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-amber-500 text-white text-sm text-center">
      接続が切れました。再接続中…
    </div>
  ) : null;

  const errorBanner = answerError !== null ? (
    <div role="alert" className="fixed top-0 left-0 right-0 z-50">
      <button
        type="button"
        onClick={() => setAnswerError(null)}
        aria-label="エラーを閉じる"
        className="px-4 py-3 bg-red-500 text-white text-sm text-center w-full border-none cursor-pointer hover:bg-red-600 transition-colors duration-200"
      >
        {answerError}（タップで閉じる）
      </button>
    </div>
  ) : null;

  switch (phase) {
    case "profile":
      return (
        <>
          {errorBanner}
          <ProfilePage onJoin={handleJoin} isJoining={isJoining} teams={roomTeams} />
        </>
      );
    case "waiting":
      return <>{disconnectBanner}<WaitingPage roomCode={roomCode} message="次の問題を待っています…" /></>;
    case "answer":
      return (
        <>
          {disconnectBanner}
          {errorBanner}
          <AnswerPage
            question={currentQuestion}
            timeRemaining={timeRemaining}
            hasAnswered={hasAnswered}
            onAnswer={handleAnswer}
            answerCount={answerCount}
          />
        </>
      );
    case "result":
      return <>{disconnectBanner}<ResultPage result={questionResult} question={currentQuestion} /></>;
    case "ranking":
      return <>{disconnectBanner}<ParticipantRankingPage data={rankingData} participantId={participantId} /></>;
    case "final":
      return (
        <>
          {disconnectBanner}
          {errorBanner}
          <ParticipantFinalPage
            data={finalData}
            participantId={participantId}
            resultsRevealed={resultsRevealed}
            onDeleteMyData={handleDeleteMyData}
            dataDeleted={myDataDeleted}
          />
        </>
      );
    case "closed":
      return <ThankYouScreen participants={closedParticipants} />;
  }
}
