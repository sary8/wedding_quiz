import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { FinalResultData, FinalRankingEntry } from "../../types";

function fireConfetti(options: {
  particleCount?: number;
  spread?: number;
  colors?: string[];
  origin?: { x?: number; y?: number };
}) {
  void import("canvas-confetti").then((m) => m.default(options));
}

type Props = {
  data: FinalResultData | null;
  onReplay?: () => void;
  onCloseGame?: () => void;
  isDisplay?: boolean;
  onSpotlight?: (rank: number) => void;
};

type RevealPhase = "teamReveal" | "scroll" | "top3" | "winner" | "done" | "group";

function getScrollDelay(rank: number): number {
  if (rank > 20) return 200;
  if (rank > 10) return 500;
  if (rank > 3) return 1000;
  return 1000;
}

const MEDAL_CLASSES: Record<number, string> = {
  1: "bg-medal-gold",
  2: "bg-medal-silver",
  3: "bg-medal-bronze",
};

const PASTEL_BORDER_CLASSES = [
  "border-choice-pastel-rose",
  "border-choice-pastel-sky",
  "border-choice-pastel-mint",
  "border-choice-pastel-amber",
];

const PASTEL_BG_CLASSES = [
  "bg-choice-pastel-rose/40",
  "bg-choice-pastel-sky/40",
  "bg-choice-pastel-mint/40",
  "bg-choice-pastel-amber/40",
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function FinalPage({ data, onReplay, onCloseGame, isDisplay, onSpotlight }: Props) {
  const hasTeamRankings = (data?.teamRankings?.length ?? 0) > 0;
  const [phase, setPhase] = useState<RevealPhase>(hasTeamRankings ? "teamReveal" : "scroll");
  const [visibleIndex, setVisibleIndex] = useState(-1);
  const [spotlightEntry, setSpotlightEntry] = useState<FinalRankingEntry | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const onSpotlightRef = useRef(onSpotlight);
  onSpotlightRef.current = onSpotlight;
  const prefersReducedMotion = useReducedMotion();

  const { rankings, reversed, top3 } = useMemo(() => {
    const r = data?.rankings ?? [];
    return {
      rankings: r,
      reversed: [...r].reverse(),
      top3: [...r.filter((e) => e.rank <= 3)].sort((a, b) => b.rank - a.rank),
    };
  }, [data]);

  const sortedTeams = useMemo(
    () => [...(data?.teamRankings ?? [])].sort((a, b) => b.rank - a.rank),
    [data?.teamRankings],
  );

  // チームランキング発表フェーズ
  const [teamRevealIndex, setTeamRevealIndex] = useState(-1);
  useEffect(() => {
    if (phase !== "teamReveal" || sortedTeams.length === 0) return;
    const teamRankings = sortedTeams;
    let cancelled = false;
    let i = 0;

    function showNext() {
      if (cancelled || i >= teamRankings.length) {
        if (!cancelled) {
          // 1位表示後の紙吹雪
          if (!prefersReducedMotion) {
            fireConfetti({ particleCount: 150, spread: 100, colors: ["#ffd700", "#ffec8b", "#f59e0b"] });
          }
          // scroll フェーズに遷移
          setTimeout(() => {
            if (!cancelled) setPhase("scroll");
          }, 3000);
        }
        return;
      }
      setTeamRevealIndex(i);
      i++;
      setTimeout(showNext, 2500);
    }

    const initTimer = setTimeout(showNext, 500);
    return () => { cancelled = true; clearTimeout(initTimer); };
  }, [phase, sortedTeams, prefersReducedMotion]);

  // スクロール演出 (setTimeout再帰で速度を段階制御)
  useEffect(() => {
    if (phase !== "scroll" || reversed.length === 0) return;

    let cancelled = false;
    let index = 0;

    function showNext() {
      if (cancelled || index >= reversed.length) return;

      const entry = reversed[index];

      // Top3に達したらスクロール停止 → top3フェーズへ
      if (entry.rank <= 3) {
        setPhase("top3");
        return;
      }

      setVisibleIndex(index);
      index++;

      // 次のエントリの rank でディレイを決定
      const nextEntry = reversed[index];
      const delay = nextEntry ? getScrollDelay(nextEntry.rank) : 300;
      setTimeout(showNext, delay);
    }

    // 初回は少し待ってから開始
    const initTimer = setTimeout(showNext, 500);

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
    };
  }, [phase, reversed]);

  // Top3演出（一時停止対応）
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; });

  useEffect(() => {
    if (phase !== "top3") return;

    let cancelled = false;
    let i = 0;

    function showNext() {
      if (cancelled || i >= top3.length) {
        if (!cancelled && i >= top3.length) setPhase("done");
        return;
      }
      // 一時停止中はリトライ
      if (isPausedRef.current) {
        setTimeout(showNext, 200);
        return;
      }

      const entry = top3[i];
      setSpotlightEntry(entry);

      if (onSpotlightRef.current && entry.rank >= 1 && entry.rank <= 3) {
        onSpotlightRef.current(entry.rank);
      }

      if (!prefersReducedMotion) {
        if (entry.rank === 3) {
          fireConfetti({ particleCount: 50, spread: 60, colors: ["#cd7f32", "#b87333"] });
        } else if (entry.rank === 2) {
          fireConfetti({ particleCount: 100, spread: 80, colors: ["#c0c0c0", "#d4d4d4"] });
        } else if (entry.rank === 1) {
          fireConfetti({ particleCount: 200, spread: 120, colors: ["#ffd700", "#ffec8b", "#ff6347"] });
          setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { x: 0.2 } }), 500);
          setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { x: 0.8 } }), 1000);
        }
      }

      i++;
      setTimeout(showNext, 4000);
    }

    showNext();

    return () => { cancelled = true; };
  }, [phase, top3, prefersReducedMotion]);

  // done → 5秒後に group フェーズへ自動遷移
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("group"), 5000);
    return () => clearTimeout(timer);
  }, [phase]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  if (!data || rankings.length === 0) return null;

  // チームランキング発表フェーズ
  if (phase === "teamReveal" && data.teamRankings) {
    return (
      <div className="h-[100dvh] bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center text-gray-900 p-6">
        <h2 className="font-script text-5xl lg:text-7xl text-amber-800 mb-8 [text-wrap:balance]">チーム結果発表</h2>
        <div className="flex flex-col gap-4 max-w-2xl w-full">
          <AnimatePresence>
            {sortedTeams.slice(0, teamRevealIndex + 1).map((team) => (
              <motion.div
                key={team.teamId}
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
                className={[
                  "flex items-center gap-4 px-8 py-5 rounded-2xl",
                  team.rank === 1
                    ? "bg-amber-200/80 ring-4 ring-amber-400 text-amber-900"
                    : "bg-white/80 text-gray-800",
                ].join(" ")}
              >
                <span className="text-4xl font-bold w-16 text-center">{team.rank}位</span>
                <span className="flex-1 text-2xl font-bold">{team.teamName}</span>
                <span className="text-2xl font-bold [font-variant-numeric:tabular-nums]">{team.totalScore.toLocaleString()}点</span>
                <span className="text-sm text-gray-500">{team.memberCount}人</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // 集合写真フェーズ
  if (phase === "group") {
    return <GroupPhotoView rankings={rankings} onReplay={onReplay} onCloseGame={onCloseGame} isDisplay={isDisplay} prefersReducedMotion={prefersReducedMotion} />;
  }

  // Top3 スポットライト表示（メダル背景はそのまま維持）
  if ((phase === "top3" || phase === "done") && spotlightEntry) {
    const medalClass = MEDAL_CLASSES[spotlightEntry.rank] || "bg-gradient-to-b from-blush to-white text-gray-900";
    const accuracyPercent = spotlightEntry.totalQuestions > 0
      ? Math.round((spotlightEntry.correctCount / spotlightEntry.totalQuestions) * 100)
      : 0;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={spotlightEntry.participantId}
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, type: "spring" }}
          className={`h-[100dvh] flex flex-col items-center justify-center relative ${medalClass}`}
        >
          {/* 一時停止ボタン（スクリーンには表示しない） */}
          {!isDisplay && (
            <button
              type="button"
              onClick={togglePause}
              className="absolute top-4 right-4 px-4 py-2 rounded-lg bg-black/20 text-inherit text-sm min-h-[44px] hover:bg-black/30 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {isPaused ? "再開" : "一時停止"}
            </button>
          )}

          {phase === "done" && !isDisplay && (
            <div className="absolute bottom-8 flex gap-4">
              {onReplay && (
                <button
                  type="button"
                  onClick={onReplay}
                  className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold min-h-[44px] hover:bg-amber-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  もう一度プレイ
                </button>
              )}
              {onCloseGame && (
                <button
                  type="button"
                  onClick={onCloseGame}
                  className="px-8 py-4 rounded-xl bg-pink-200/80 text-pink-900 text-lg font-bold min-h-[44px] hover:bg-pink-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
                >
                  ゲーム終了
                </button>
              )}
            </div>
          )}

          <motion.div
            initial={prefersReducedMotion ? false : { y: -50 }}
            animate={{ y: 0 }}
            className="text-5xl md:text-8xl font-bold mb-4"
          >
            第{spotlightEntry.rank}位
          </motion.div>

          {spotlightEntry.selfieUrl ? (
            <img
              src={spotlightEntry.selfieUrl}
              alt={`${spotlightEntry.nickname}のアバター`}
              width={192}
              height={192}
              className="w-48 h-48 rounded-full object-cover mb-6 border-[6px] border-white/50"
            />
          ) : (
            <div
              className="w-48 h-48 rounded-full flex items-center justify-center text-8xl font-bold mb-6 bg-white/30"
            >
              {spotlightEntry.nickname?.[0] || "?"}
            </div>
          )}

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.5 }}
            className="text-center"
          >
            <div className="text-3xl md:text-5xl font-bold mb-2">{spotlightEntry.nickname}</div>
            <div className="text-2xl md:text-4xl mb-6">{spotlightEntry.totalScore.toLocaleString()}点</div>
            <div className="text-base md:text-lg opacity-90">
              正答率: {accuracyPercent}% / 平均回答速度: {(spotlightEntry.averageResponseTimeMs / 1000).toFixed(2)}秒
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // スクロール表示
  return (
    <div
      ref={containerRef}
      className="h-[100dvh] overflow-hidden bg-gradient-to-b from-blush to-white text-gray-900 flex flex-col items-center justify-end p-6"
    >
      <h2 className="font-script text-5xl lg:text-7xl text-amber-800 absolute top-6 [text-wrap:balance]">最終結果発表</h2>
      <AnimatePresence>
        {reversed.slice(0, visibleIndex + 1).map((entry) => (
          <motion.div
            key={entry.participantId}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className={[
              "flex items-center gap-4 px-6 py-2 mb-1",
              entry.rank <= 10 ? "text-2xl lg:text-3xl font-bold" : "text-lg lg:text-xl font-normal",
            ].join(" ")}
          >
            <span className="w-10 text-center">{entry.rank}位</span>
            {entry.selfieUrl ? (
              <img
                src={entry.selfieUrl}
                alt={`${entry.nickname}のアバター`}
                width={36}
                height={36}
                className={`w-9 h-9 rounded-full object-cover border-2 ${PASTEL_BORDER_CLASSES[entry.rank % PASTEL_BORDER_CLASSES.length]} shrink-0`}
                loading="lazy"
              />
            ) : (
              <div className={`w-9 h-9 rounded-full ${PASTEL_BG_CLASSES[entry.rank % PASTEL_BG_CLASSES.length]} flex items-center justify-center text-gray-900 shrink-0`}>
                {entry.nickname?.[0] || "?"}
              </div>
            )}
            <span className="w-28 truncate">{entry.nickname}</span>
            <span>{entry.totalScore.toLocaleString()}点</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

type FloatConfig = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
};

function generateFloatConfigs(rankings: FinalRankingEntry[]): FloatConfig[] {
  return rankings.map((entry) => {
    const r1 = seededRandom(entry.participantId);
    const r2 = seededRandom(entry.participantId + 1000);
    const r3 = seededRandom(entry.participantId + 2000);
    const r4 = seededRandom(entry.participantId + 3000);
    const r5 = seededRandom(entry.participantId + 4000);
    return {
      startX: r1 * 80 + 5,
      startY: r2 * 70 + 10,
      endX: r3 * 80 + 5,
      endY: r4 * 70 + 10,
      duration: 10 + r5 * 15,
    };
  });
}

type GroupPhotoProps = {
  rankings: FinalRankingEntry[];
  onReplay?: () => void;
  onCloseGame?: () => void;
  isDisplay?: boolean;
  prefersReducedMotion: boolean | null;
};

function GroupPhotoView({ rankings, onReplay, onCloseGame, isDisplay, prefersReducedMotion }: GroupPhotoProps) {
  const floatConfigs = useMemo(() => generateFloatConfigs(rankings), [rankings]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    fireConfetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
  }, [prefersReducedMotion]);

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* タイトル */}
      <motion.h2
        initial={prefersReducedMotion ? false : { opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="font-script text-4xl md:text-5xl text-amber-800 text-center z-10 [text-wrap:balance]"
      >
        みんなで記念撮影！
      </motion.h2>

      {/* 浮遊アバター or 静的グリッド */}
      {prefersReducedMotion ? (
        <div className="flex flex-wrap justify-center gap-3 max-w-5xl z-0 px-4 mt-8">
          {rankings.map((entry, i) => (
            <GroupAvatarBubble key={entry.participantId} entry={entry} index={i} />
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 z-0">
          {rankings.map((entry, i) => {
            const config = floatConfigs[i];
            return (
              <motion.div
                key={entry.participantId}
                className="absolute"
                initial={{
                  left: `${config.startX}%`,
                  top: `${config.startY}%`,
                }}
                animate={{
                  left: [`${config.startX}%`, `${config.endX}%`],
                  top: [`${config.startY}%`, `${config.endY}%`],
                }}
                transition={{
                  duration: config.duration,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
              >
                <GroupAvatarBubble entry={entry} index={i} />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ボタン群 */}
      {!isDisplay && (onReplay || onCloseGame) && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 flex gap-4 z-10"
        >
          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold min-h-[44px] hover:bg-amber-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              もう一度プレイ
            </button>
          )}
          {onCloseGame && (
            <button
              type="button"
              onClick={onCloseGame}
              className="px-8 py-4 rounded-xl bg-pink-200/80 text-pink-900 text-lg font-bold min-h-[44px] hover:bg-pink-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
            >
              ゲーム終了
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

type GroupAvatarProps = {
  entry: FinalRankingEntry;
  index: number;
};

function GroupAvatarBubble({ entry, index }: GroupAvatarProps) {
  const borderClass = PASTEL_BORDER_CLASSES[index % PASTEL_BORDER_CLASSES.length];
  const bgClass = PASTEL_BG_CLASSES[index % PASTEL_BG_CLASSES.length];

  return (
    <div className="flex flex-col items-center">
      {entry.selfieUrl ? (
        <img
          src={entry.selfieUrl}
          alt={`${entry.nickname}のアバター`}
          width={80}
          height={80}
          className={`w-14 h-14 md:w-20 md:h-20 rounded-full object-cover border-[3px] ${borderClass} shadow-lg`}
          loading="lazy"
        />
      ) : (
        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold ${bgClass} text-gray-900 border-[3px] ${borderClass} shadow-lg`}>
          {entry.nickname?.[0] || "?"}
        </div>
      )}
      <span className="text-gray-700 text-xs mt-1 max-w-[80px] truncate text-center">
        {entry.nickname}
      </span>
    </div>
  );
}
