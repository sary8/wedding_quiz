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
  RankingViewMode,
} from "../../types";
import { useGameSounds } from "../../hooks/useGameSounds";
import { useBgm } from "../../hooks/useBgm";
import { deleteQuiz } from "../../services/api";
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
  const { emit, emitWithTimeout, on, isConnected, connectionError, reconnectFailed } = useSocket();
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
  // 新問題開始後に前問の遅延 questionResult を割り込ませないためのガード（M-4）
  const activeQuestionIdRef = useRef<number | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      // サーバーからの警告（別タブでホスト画面が開かれた等）を表示する（L-6）
      on("error", (data) => setError(data.message)),
      on("lobbyUpdate", (data) => {
        setParticipants(data.participants);
        if (data.teams) setLobbyTeams(data.teams);
      }),
      on("participantJoined", () => {
        playJoinChime();
      }),
      on("questionStarted", (data) => {
        activeQuestionIdRef.current = data.questionId;
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
        // 既に次の問題が始まっている場合、前問の遅延結果は無視する（M-4）
        if (activeQuestionIdRef.current !== null && data.questionId !== activeQuestionIdRef.current) return;
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
        if (data.quizStatus === "finished") {
          if (data.finalData) {
            setFinalData(data.finalData);
          }
          setPhase("final");
        } else if (data.quizStatus === "in_progress") {
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
  }, [isConnected, roomCode, quizId, hostSecret, emit]);

  // ゲーム開始 → カウントダウンへ遷移
  const handleStartGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    emitWithTimeout("startGame", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) {
        setError(res.error || "ゲームの開始に失敗しました");
        return;
      }
      setCountdownValue(5);
      setPhase("countdown");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

  const handleNextQuestion = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    emitWithTimeout("nextQuestion", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "問題の配信に失敗しました");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

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
    emitWithTimeout("closeQuestion", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "問題の締め切りに失敗しました");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

  const handleShowRanking = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emitWithTimeout("showRanking", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "ランキングの表示に失敗しました");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

  const handleEndGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    if (!window.confirm("ゲームを終了して最終結果を表示しますか？")) return;
    setIsProcessing(true);
    emitWithTimeout("endGame", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "ゲーム終了に失敗しました");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

  const handleReplay = useCallback(() => {
    if (!roomCode || isProcessing) return;
    setIsProcessing(true);
    emitWithTimeout("replayQuiz", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "リプレイに失敗しました");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

  const handleRevealNext = useCallback(() => {
    if (!roomCode) return;
    emit("revealNextRank", { roomCode, hostSecret }, () => {});
  }, [roomCode, hostSecret, emit]);

  const handleRankingViewChange = useCallback((page: number, mode: RankingViewMode) => {
    if (!roomCode) return;
    emit("setRankingPage", { roomCode, hostSecret, page, mode }, () => {});
  }, [roomCode, hostSecret, emit]);

  const handleShowParticipantResults = useCallback(() => {
    if (!roomCode) return;
    emit("showParticipantResults", { roomCode, hostSecret }, () => {});
  }, [roomCode, hostSecret, emit]);

  const handleCloseGame = useCallback(() => {
    if (!roomCode || isProcessing) return;
    if (!window.confirm("ルームを閉じますか？参加者全員が切断されます。")) return;
    setIsProcessing(true);
    emitWithTimeout("closeGame", { roomCode, hostSecret }, (res) => {
      setIsProcessing(false);
      if (!res.success) setError(res.error || "ゲームの終了に失敗しました");
    });
  }, [roomCode, hostSecret, emitWithTimeout, isProcessing]);

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

  const handleDeleteQuiz = useCallback(async () => {
    await deleteQuiz(quizId);
    navigate("/host/setup");
  }, [quizId, navigate]);

  if (!roomCode) return <div>ルームコードが不正です</div>;

  // 接続エラー表示
  if ((connectionError || reconnectFailed) && !isConnected) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical px-6">
        <div className="glass-card rounded-3xl p-10 flex flex-col items-center gap-4 animate-fade-up max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 0 1-12.73 0"/><path d="M5.64 6.64a9 9 0 0 0 12.73 0"/><circle cx="12" cy="12" r="1"/></svg>
          </div>
          <p className="text-lg font-bold text-sage-text">接続が切れました</p>
          {reconnectFailed ? (
            <>
              <p className="text-sm text-sage-text/60 text-center">再接続できませんでした。ページを再読み込みしてください。</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold min-h-[44px] hover:opacity-90 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                再読み込み
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-sage-text/60">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              再接続を試みています…
            </div>
          )}
        </div>
      </div>
    );
  }

  // エラーバナー
  const errorBanner = error ? (
    <div role="alert" className="fixed top-0 left-0 right-0 z-50 animate-fade-in">
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label="エラーを閉じる"
        className="px-6 py-3.5 bg-red-500/95 backdrop-blur-sm text-white text-sm text-center w-full border-none cursor-pointer hover:bg-red-600 transition-colors duration-200 shadow-lg"
      >
        {error}（タップで閉じる）
      </button>
    </div>
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
              onBack={isRehearsal ? handleBackToSetup : undefined}
              isProcessing={isProcessing}
            />
          </>
        );
      case "countdown":
        return (
          <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical overflow-hidden">
            <p className="font-serif-wedding text-2xl tracking-[0.3em] text-sage-text/60 uppercase mb-6 animate-fade-up">
              Get Ready
            </p>
            <div className="relative">
              <p
                className="text-[12rem] font-bold leading-none text-primary motion-safe:animate-scale-pulse drop-shadow-[0_4px_24px_rgba(107,143,113,0.2)]"
                aria-live="polite"
                aria-atomic="true"
              >
                {countdownValue > 0 ? countdownValue : ""}
              </p>
              {countdownValue > 0 && (
                <div className="absolute inset-0 rounded-full border-4 border-accent/20 motion-safe:animate-[scale-pulse_1s_ease-in-out_infinite]" aria-hidden="true" />
              )}
            </div>
            <div className="gold-line w-32 mt-8" />
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
              onEndGame={handleEndGame}
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
              onRankingViewChange={handleRankingViewChange}
            />
          </>
        );
      case "final":
        return (
          <>
            {errorBanner}
            <FinalPage data={finalData} onReplay={handleReplay} onCloseGame={handleCloseGame} onRevealNext={handleRevealNext} onDrumRoll={playDrumRoll} onSpotlight={playFanfare} onShowParticipantResults={handleShowParticipantResults} />
          </>
        );
      case "closed":
        return (
          <ThankYouScreen
            participants={closedParticipants}
            onBackToSetup={handleBackToSetup}
            onDeleteQuiz={handleDeleteQuiz}
          />
        );
      case "recovering":
        return (
          <>
            {errorBanner}
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical px-6">
              <div className="glass-card-strong rounded-3xl p-10 flex flex-col items-center gap-6 animate-fade-up max-w-md">
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-sage-text mb-1">ゲームを再開</p>
                  <p className="text-sm text-sage-text/60">ゲームは進行中です。操作を続けてください。</p>
                </div>
                <div className="gold-line w-full" />
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white text-base font-bold min-h-[44px] hover:opacity-90 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    次の問題を配信
                  </button>
                  <button
                    type="button"
                    onClick={handleShowRanking}
                    className="flex-1 px-6 py-4 rounded-xl bg-accent/10 text-accent text-base font-bold min-h-[44px] hover:bg-accent/20 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  >
                    ランキング表示
                  </button>
                </div>
              </div>
            </div>
          </>
        );
    }
  })();

  return (
    <Suspense fallback={<div className="h-[100dvh] flex items-center justify-center bg-botanical"><p className="text-lg text-sage-text/60 font-serif-wedding tracking-wider">Loading…</p></div>}>
      {isProcessing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-[2px] pointer-events-none">
          <div className="glass-card rounded-2xl p-4">
            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" aria-label="処理中">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      )}
      {isRehearsal && (
        <div className="fixed top-0 left-0 right-0 bg-amber-400/90 backdrop-blur-sm text-amber-900 text-center py-2 text-xs font-bold tracking-wider z-40 shadow-sm">
          REHEARSAL MODE
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
