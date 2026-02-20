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
  isDisplay?: boolean;
  onSpotlight?: (rank: number) => void;
};

type RevealPhase = "scroll" | "top3" | "winner" | "done" | "group";

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

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function FinalPage({ data, onReplay, isDisplay, onSpotlight }: Props) {
  const [phase, setPhase] = useState<RevealPhase>("scroll");
  const [visibleIndex, setVisibleIndex] = useState(-1);
  const [spotlightEntry, setSpotlightEntry] = useState<FinalRankingEntry | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { rankings, reversed, top3 } = useMemo(() => {
    const r = data?.rankings ?? [];
    return {
      rankings: r,
      reversed: [...r].reverse(),
      top3: r.filter((e) => e.rank <= 3).sort((a, b) => b.rank - a.rank),
    };
  }, [data]);

  // スクロール演出 (setTimeout再帰で速度を段階制御)
  useEffect(() => {
    if (reversed.length === 0) return;

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
  }, [reversed]);

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

      if (onSpotlight && entry.rank >= 1 && entry.rank <= 3) {
        onSpotlight(entry.rank);
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

  // 集合写真フェーズ
  if (phase === "group") {
    return <GroupPhotoView rankings={rankings} onReplay={onReplay} isDisplay={isDisplay} prefersReducedMotion={prefersReducedMotion} />;
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
          {/* 一時停止ボタン */}
          <button
            type="button"
            onClick={togglePause}
            className="absolute top-4 right-4 px-4 py-2 rounded-lg bg-black/20 text-inherit text-sm min-h-[44px] hover:bg-black/30 transition-colors duration-200 cursor-pointer"
          >
            {isPaused ? "再開" : "一時停止"}
          </button>

          {phase === "done" && onReplay && !isDisplay && (
            <button
              type="button"
              onClick={onReplay}
              className="absolute bottom-8 px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold min-h-[44px] hover:brightness-110 transition-[filter] duration-200 cursor-pointer"
            >
              もう一度プレイ
            </button>
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
            <div className="text-base md:text-lg opacity-80">
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
      <h2 className="font-script text-4xl text-amber-800 absolute top-6">最終結果発表</h2>
      <AnimatePresence>
        {reversed.slice(0, visibleIndex + 1).map((entry) => (
          <motion.div
            key={entry.participantId}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className={[
              "flex items-center gap-4 px-6 py-2 mb-1",
              entry.rank <= 10 ? "text-xl font-bold" : "text-base font-normal",
            ].join(" ")}
          >
            <span className="w-10 text-center">{entry.rank}位</span>
            {entry.selfieUrl ? (
              <img
                src={entry.selfieUrl}
                alt={`${entry.nickname}のアバター`}
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                {entry.nickname?.[0] || "?"}
              </div>
            )}
            <span className="w-28">{entry.nickname}</span>
            <span>{entry.totalScore.toLocaleString()}点</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

type GroupPhotoProps = {
  rankings: FinalRankingEntry[];
  onReplay?: () => void;
  isDisplay?: boolean;
  prefersReducedMotion: boolean | null;
};

function GroupPhotoView({ rankings, onReplay, isDisplay, prefersReducedMotion }: GroupPhotoProps) {
  useEffect(() => {
    if (prefersReducedMotion) return;
    fireConfetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
  }, [prefersReducedMotion]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-blush to-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* タイトル */}
      <motion.h2
        initial={prefersReducedMotion ? false : { opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="font-script text-4xl md:text-5xl text-amber-800 mb-8 text-center z-10"
      >
        みんなで記念撮影！
      </motion.h2>

      {/* グリッド */}
      <div className="flex flex-wrap justify-center gap-3 max-w-5xl z-10">
        {rankings.map((entry, i) => {
          const rotate = seededRandom(entry.participantId) * 12 - 6;
          return (
            <motion.div
              key={entry.participantId}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0, rotate: rotate * 2 }}
              animate={{ opacity: 1, scale: 1, rotate }}
              transition={prefersReducedMotion
                ? { duration: 0 }
                : { delay: i * 0.05, duration: 0.4, type: "spring", stiffness: 200 }
              }
              className="flex flex-col items-center"
            >
              {entry.selfieUrl ? (
                <img
                  src={entry.selfieUrl}
                  alt={`${entry.nickname}のアバター`}
                  width={80}
                  height={80}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-[3px] border-gray-300 shadow-lg"
                  loading="lazy"
                />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-primary/60 text-white border-[3px] border-gray-300 shadow-lg">
                  {entry.nickname?.[0] || "?"}
                </div>
              )}
              <span className="text-gray-700 text-xs mt-1 max-w-[80px] truncate text-center">
                {entry.nickname}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* もう一度プレイ */}
      {onReplay && !isDisplay && (
        <motion.button
          type="button"
          onClick={onReplay}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(rankings.length * 0.05 + 0.5, 3) }}
          className="mt-10 px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold min-h-[44px] hover:brightness-110 transition-[filter] duration-200 z-10 cursor-pointer"
        >
          もう一度プレイ
        </motion.button>
      )}
    </div>
  );
}
