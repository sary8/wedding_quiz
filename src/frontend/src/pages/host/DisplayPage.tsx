import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
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

type DisplayPhase = "lobby" | "countdown" | "question" | "results" | "ranking" | "final" | "closed";

const NOOP = () => {}; // stable reference for display-only props

export function DisplayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { emit, on, isConnected, connectionError } = useSocket();
  const { playJoinChime, playQuestionStart, playTick, playBuzzer, playResultReveal, playRankingFanfare, playDrumRoll, playFanfare } = useGameSounds();
  const bgm = useBgm();

  const [phase, setPhase] = useState<DisplayPhase>("lobby");
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [lobbyTeams, setLobbyTeams] = useState<TeamInfo[] | undefined>(undefined);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [questionResult, setQuestionResult] = useState<QuestionResultData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [finalData, setFinalData] = useState<FinalResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState(5);
  const [closedParticipants, setClosedParticipants] = useState<ParticipantInfo[]>([]);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Socket.ioイベント登録
  useEffect(() => {
    const unsubs = [
      on("lobbyUpdate", (data) => {
        setParticipants(data.participants);
        if (data.teams) setLobbyTeams(data.teams);
      }),
      on("gameStarted", () => {
        setCountdownValue(5);
        setPhase("countdown");
      }),
      on("participantJoined", (participant) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.id === participant.id)) return prev;
          return [...prev, participant];
        });
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
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 gap-4">
        <p className="text-xl text-red-600">{connectionError}</p>
        <p className="text-sm text-gray-500">ページを再読み込みしてください</p>
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
              onStartGame={NOOP}
              isDisplay={true}
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
            <FinalPage data={finalData} isDisplay={true} onSpotlight={playFanfare} />
          </>
        );
      case "closed":
        return (
          <ThankYouScreen
            participants={closedParticipants}
            isDisplay={true}
          />
        );
    }
  })();

  return (
    <Suspense fallback={null}>
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
