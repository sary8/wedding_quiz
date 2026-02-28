import { useState, useEffect, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import type {
  ParticipantInfo,
  TeamInfo,
  QuestionData,
  QuestionResultData,
  RankingData,
  FinalResultData,
} from "../../types";
import { useGameSounds } from "../../hooks/useGameSounds";
import { useBgm } from "../../hooks/useBgm";
import { BgmControls } from "../../components/ui/BgmControls";
import { LobbyPage } from "./LobbyPage";
import { QuestionPage } from "./QuestionPage";

const ResultsPage = lazy(() => import("./ResultsPage").then((m) => ({ default: m.ResultsPage })));
const RankingPage = lazy(() => import("./RankingPage").then((m) => ({ default: m.RankingPage })));
const FinalPage = lazy(() => import("./FinalPage").then((m) => ({ default: m.FinalPage })));
const ThankYouScreen = lazy(() => import("./ThankYouScreen").then((m) => ({ default: m.ThankYouScreen })));

type HostPhase = "lobby" | "countdown" | "question" | "results" | "ranking" | "final" | "closed" | "recovering";

export function HostPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const quizId = Number(searchParams.get("quizId")) || 0;
  const isRehearsal = searchParams.get("rehearsal") === "true";
  const navigate = useNavigate();

  // hostSecret: sessionStorage優先、URLフォールバック（後方互換）
  const urlKey = searchParams.get("key");
  const hostSecret = useMemo(() => {
    const stored = roomCode ? sessionStorage.getItem(`host_secret_${roomCode}`) : null;
    if (stored) return stored;
    if (urlKey && roomCode) {
      sessionStorage.setItem(`host_secret_${roomCode}`, urlKey);
      return urlKey;
    }
    return "";
  }, [roomCode, urlKey]);

  // URLからkeyパラメータを除去
  useEffect(() => {
    if (urlKey) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("key");
        return next;
      }, { replace: true });
    }
  }, [urlKey, setSearchParams]);
  const { emit, on, isConnected, connectionError } = useSocket();
  const { playJoinChime, playQuestionStart, playTick, playBuzzer, playResultReveal, playRankingFanfare, playDrumRoll, playFanfare } = useGameSounds();
  const bgm = useBgm();

  const [phase, setPhase] = useState<HostPhase>("lobby");
  const [closedParticipants, setClosedParticipants] = useState<ParticipantInfo[]>([]);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [lobbyTeams, setLobbyTeams] = useState<TeamInfo[] | undefined>(undefined);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const countdownFiredRef = useRef(false);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("lobbyUpdate", (data) => {
        setParticipants(data.participants);
        if (data.teams) setLobbyTeams(data.teams);
      }),
      on("participantJoined", () => {
        playJoinChime();
      }),
      on("questionStarted", (data) => {
        setCurrentQuestion(data);
        setTimeRemaining(data.timeLimitSeconds);
        setAnswerCount(0);
        setQuestionResult(null);
        setPhase("question");
        playQuestionStart();
        if (resultTimeoutRef.current) {
          clearTimeout(resultTimeoutRef.current);
          resultTimeoutRef.current = null;
        }
      }),
      on("timeUpdate", (data) => {
        setTimeRemaining(Math.max(0, data.remaining));
        if (data.remaining <= 5 && data.remaining > 0) {
          playTick();
        }
      }),
      on("answerCountUpdate", (data) => setAnswerCount(data.count)),
      on("questionClosed", () => {
        playBuzzer();
        // 5秒以内にquestionResultが届かなければ自動で results フェーズへ遷移
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
        playResultReveal();
      }),
      on("rankingUpdate", (data) => {
        setRankingData(data);
        setPhase("ranking");
        playRankingFanfare();
      }),
      on("gameEnded", (data) => {
        setFinalData(data);
        setPhase("final");
        playDrumRoll();
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
      on("hostReconnected", (data) => {
        setParticipants(data.participants);
        if (data.quizStatus === "in_progress") {
          if (data.currentQuestionData && data.timerRemaining && data.timerRemaining > 0) {
            // 出題中: question フェーズを復元
            setCurrentQuestion(data.currentQuestionData);
            setTimeRemaining(Math.max(0, data.timerRemaining));
            setAnswerCount(data.answerCount ?? 0);
            setQuestionResult(null);
            setPhase("question");
          } else if (data.currentQuestionData && (data.timerRemaining === 0 || !data.timerRemaining)) {
            // タイムアップ済み: results フェーズへ
            setCurrentQuestion(data.currentQuestionData);
            setTimeRemaining(0);
            setAnswerCount(data.answerCount ?? 0);
            setPhase("results");
          } else {
            setPhase("recovering");
          }
        }
      }),
      on("gameClosed", (data) => {
        setClosedParticipants(data.participants);
        setPhase("closed");
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, playJoinChime, playQuestionStart, playTick, playBuzzer, playResultReveal, playRankingFanfare, playDrumRoll]);

  // フェーズに応じたBGMトラック自動切替
  const bgmPlay = bgm.play;
  const bgmFadeOut = bgm.fadeOut;
  useEffect(() => {
    switch (phase) {
      case "lobby":
        bgmPlay("lobby");
        break;
      case "countdown":
      case "question":
        bgmPlay("question");
        break;
      case "results":
      case "ranking":
      case "final":
        bgmPlay("results");
        break;
      case "closed":
        bgmFadeOut();
        break;
    }
  }, [phase, bgmPlay, bgmFadeOut]);

  // ルーム開設（初回接続 + 再接続時に再実行してルームに再join）
  useEffect(() => {
    if (!isConnected || !roomCode) return;
    emit("openRoom", { quizId, hostSecret }, (res) => {
      if (!res.success) setError(res.error || "ルームの開設に失敗しました");
    });

    emit("watchRoom", { roomCode }, () => {});
  }, [isConnected, roomCode, quizId, hostSecret, emit, on]);

  // ゲーム開始 → カウントダウンへ遷移
  const handleStartGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    emit("startGame", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) {
        setError(res.error || "ゲームの開始に失敗しました");
        return;
      }
      setCountdownValue(5);
      setPhase("countdown");
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

  // カウントダウン: 5→4→3→2→1→0 → 最初の問題を配信
  useEffect(() => {
    if (phase !== "countdown") {
      countdownFiredRef.current = false;
      return;
    }
    if (countdownValue <= 0) {
      if (!countdownFiredRef.current) {
        countdownFiredRef.current = true;
        const t = setTimeout(handleNextQuestion, 0);
        return () => clearTimeout(t);
      }
      return;
    }
    const timer = setTimeout(() => setCountdownValue((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdownValue, handleNextQuestion]);

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

  const handleCloseGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emit("closeGame", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "ゲームの終了に失敗しました");
    });
  }, [roomCode, hostSecret, emit, isProcessing]);

  // リハーサルモード: 最終問題後に自動リプレイ
  useEffect(() => {
    if (!isRehearsal || phase !== "final") return;
    const timer = setTimeout(() => {
      handleReplay();
    }, 5000);
    return () => clearTimeout(timer);
  }, [isRehearsal, phase, handleReplay]);

  const handleBackToSetup = useCallback(() => {
    navigate(`/host/setup?view=edit&quizId=${quizId}`);
  }, [navigate, quizId]);

  if (!roomCode) return <div>ルームコードが不正です</div>;

  // 接続エラー表示
  if (connectionError) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 gap-4">
        <p className="text-xl text-red-600">{connectionError}</p>
        <p className="text-sm text-gray-500">ページを再読み込みしてください</p>
      </div>
    );
  }

  // エラーバナー
  const errorBanner = error ? (
    <button
      type="button"
      onClick={() => setError(null)}
      aria-label="エラーを閉じる"
      className="fixed top-0 left-0 right-0 px-6 py-3 bg-red-500 text-white text-sm text-center z-50 w-full border-none cursor-pointer hover:bg-red-600 transition-colors duration-200"
    >
      {error}（タップで閉じる）
    </button>
  ) : null;

  const content = (() => {
    switch (phase) {
      case "lobby":
        return (
          <>
            {errorBanner}
            <LobbyPage
              roomCode={roomCode}
              participants={participants}
              teams={lobbyTeams}
              onStartGame={handleStartGame}
            />
          </>
        );
      case "countdown":
        return (
          <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900">
            <p className="text-2xl font-bold mb-4">ゲーム開始</p>
            <p className="text-[10rem] font-bold leading-none text-amber-800 motion-safe:animate-pulse">
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
            <FinalPage data={finalData} onReplay={handleReplay} onCloseGame={handleCloseGame} onSpotlight={playFanfare} />
          </>
        );
      case "closed":
        return (
          <ThankYouScreen
            participants={closedParticipants}
            onBackToSetup={handleBackToSetup}
          />
        );
      case "recovering":
        return (
          <>
            {errorBanner}
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 gap-6">
              <p className="text-2xl font-bold">ゲームを再開</p>
              <p className="text-gray-500">ゲームは進行中です。操作を続けてください。</p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="px-8 py-4 rounded-xl bg-pink-200/80 text-pink-900 text-lg font-bold min-h-[44px] hover:bg-pink-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
                >
                  次の問題を配信
                </button>
                <button
                  type="button"
                  onClick={handleShowRanking}
                  className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold min-h-[44px] hover:bg-amber-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  ランキング表示
                </button>
              </div>
            </div>
          </>
        );
    }
  })();

  return (
    <Suspense fallback={null}>
      {isProcessing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 pointer-events-none">
          <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" aria-label="処理中">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
      {isRehearsal && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-300 text-yellow-900 text-center py-1.5 text-sm font-bold z-40">
          リハーサルモード
        </div>
      )}
      {content}
      <BgmControls
        volume={bgm.volume}
        isMuted={bgm.isMuted}
        onVolumeChange={bgm.setVolume}
        onToggleMute={bgm.toggleMute}
      />
    </Suspense>
  );
}
