import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { FinalResultData, FinalRankingEntry } from "../../types";

type Props = {
  data: FinalResultData | null;
};

type RevealPhase = "scroll" | "top3" | "winner" | "done";

function getScrollDelay(rank: number): number {
  if (rank > 20) return 200;
  if (rank > 10) return 500;
  if (rank > 3) return 1000;
  return 1000;
}

const MEDAL_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "linear-gradient(135deg, #ffd700, #ffb300)", text: "#1a1a2e" },
  2: { bg: "linear-gradient(135deg, #c0c0c0, #e0e0e0)", text: "#1a1a2e" },
  3: { bg: "linear-gradient(135deg, #cd7f32, #d4a574)", text: "#fff" },
};

export function FinalPage({ data }: Props) {
  const [phase, setPhase] = useState<RevealPhase>("scroll");
  const [visibleIndex, setVisibleIndex] = useState(-1);
  const [spotlightEntry, setSpotlightEntry] = useState<FinalRankingEntry | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rankings = useMemo(() => data?.rankings ?? [], [data]);
  const reversed = useMemo(() => [...rankings].reverse(), [rankings]);
  const top3 = useMemo(
    () => rankings.filter((r) => r.rank <= 3).sort((a, b) => b.rank - a.rank),
    [rankings],
  );

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

  // Top3演出
  useEffect(() => {
    if (phase !== "top3") return;

    let i = 0;

    const timer = setInterval(() => {
      if (i >= top3.length) {
        clearInterval(timer);
        setPhase("done");
        return;
      }

      const entry = top3[i];
      setSpotlightEntry(entry);

      // エフェクト（prefers-reduced-motion を考慮）
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!prefersReducedMotion) {
        if (entry.rank === 3) {
          confetti({ particleCount: 50, spread: 60, colors: ["#cd7f32", "#b87333"] });
        } else if (entry.rank === 2) {
          confetti({ particleCount: 100, spread: 80, colors: ["#c0c0c0", "#d4d4d4"] });
        } else if (entry.rank === 1) {
          confetti({ particleCount: 200, spread: 120, colors: ["#ffd700", "#ffec8b", "#ff6347"] });
          setTimeout(() => confetti({ particleCount: 150, spread: 100, origin: { x: 0.2 } }), 500);
          setTimeout(() => confetti({ particleCount: 150, spread: 100, origin: { x: 0.8 } }), 1000);
        }
      }

      i++;
    }, 4000);

    return () => clearInterval(timer);
  }, [phase, top3]);

  if (!data || rankings.length === 0) return null;

  // Top3 スポットライト表示
  if ((phase === "top3" || phase === "done") && spotlightEntry) {
    const medal = MEDAL_COLORS[spotlightEntry.rank];
    const accuracyPercent = spotlightEntry.totalQuestions > 0
      ? Math.round((spotlightEntry.correctCount / spotlightEntry.totalQuestions) * 100)
      : 0;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={spotlightEntry.participantId}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="h-[100dvh] flex flex-col items-center justify-center"
          style={{ background: medal?.bg || "#1a1a2e", color: medal?.text || "#fff" }}
        >
          <motion.div
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            className="text-8xl font-bold mb-4"
          >
            第{spotlightEntry.rank}位
          </motion.div>

          {spotlightEntry.selfieUrl ? (
            <img
              src={spotlightEntry.selfieUrl}
              alt=""
              width={192}
              height={192}
              className="w-48 h-48 rounded-full object-cover mb-6"
              style={{ border: "6px solid rgba(255,255,255,0.5)" }}
            />
          ) : (
            <div
              className="w-48 h-48 rounded-full flex items-center justify-center text-8xl font-bold mb-6"
              style={{ background: "rgba(255,255,255,0.3)" }}
            >
              {spotlightEntry.nickname?.[0] || "?"}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <div className="text-5xl font-bold mb-2">{spotlightEntry.nickname}</div>
            <div className="text-4xl mb-6">{spotlightEntry.totalScore.toLocaleString()}点</div>
            <div className="text-lg opacity-80">
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
      className="h-[100dvh] overflow-hidden bg-dark text-white flex flex-col items-center justify-end p-6"
    >
      <h2 className="font-script text-4xl text-accent absolute top-6">最終結果発表</h2>
      <AnimatePresence>
        {reversed.slice(0, visibleIndex + 1).map((entry) => (
          <motion.div
            key={entry.participantId}
            initial={{ opacity: 0, y: 50 }}
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
                alt=""
                width={36}
                height={36}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
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
