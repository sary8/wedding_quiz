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

export function FinalPage({ data }: Props) {
  const [phase, setPhase] = useState<RevealPhase>("scroll");
  const [visibleIndex, setVisibleIndex] = useState(-1);
  const [spotlightEntry, setSpotlightEntry] = useState<FinalRankingEntry | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rankings = useMemo(() => data?.rankings ?? [], [data]);

  // スクロール演出 (setTimeout再帰で速度を段階制御)
  useEffect(() => {
    if (rankings.length === 0) return;

    const reversed = [...rankings].reverse(); // エフェクト内で定義して依存配列から除外
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
  }, [rankings]);

  // Top3演出
  useEffect(() => {
    if (phase !== "top3") return;

    const top3 = rankings.filter((r) => r.rank <= 3).sort((a, b) => b.rank - a.rank);
    let i = 0;

    const timer = setInterval(() => {
      if (i >= top3.length) {
        clearInterval(timer);
        setPhase("done");
        return;
      }

      const entry = top3[i];
      setSpotlightEntry(entry);

      // エフェクト
      if (entry.rank === 3) {
        confetti({ particleCount: 50, spread: 60, colors: ["#cd7f32", "#b87333"] });
      } else if (entry.rank === 2) {
        confetti({ particleCount: 100, spread: 80, colors: ["#c0c0c0", "#d4d4d4"] });
      } else if (entry.rank === 1) {
        confetti({ particleCount: 200, spread: 120, colors: ["#ffd700", "#ffec8b", "#ff6347"] });
        setTimeout(() => confetti({ particleCount: 150, spread: 100, origin: { x: 0.2 } }), 500);
        setTimeout(() => confetti({ particleCount: 150, spread: 100, origin: { x: 0.8 } }), 1000);
      }

      i++;
    }, 4000);

    return () => clearInterval(timer);
  }, [phase, rankings]);

  if (!data || rankings.length === 0) return null;

  const MEDAL_COLORS: Record<number, { bg: string; text: string }> = {
    1: { bg: "linear-gradient(135deg, #ffd700, #ffb300)", text: "#1a1a2e" },
    2: { bg: "linear-gradient(135deg, #c0c0c0, #e0e0e0)", text: "#1a1a2e" },
    3: { bg: "linear-gradient(135deg, #cd7f32, #d4a574)", text: "#fff" },
  };

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
          style={{
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: medal?.bg || "#1a1a2e",
            color: medal?.text || "#fff",
          }}
        >
          <motion.div
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            style={{ fontSize: 80, fontWeight: "bold", marginBottom: 16 }}
          >
            第{spotlightEntry.rank}位
          </motion.div>

          {spotlightEntry.selfieUrl ? (
            <img
              src={spotlightEntry.selfieUrl}
              alt=""
              style={{ width: 200, height: 200, borderRadius: "50%", objectFit: "cover", border: "6px solid rgba(255,255,255,0.5)", marginBottom: 24 }}
            />
          ) : (
            <div style={{ width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, fontWeight: "bold", marginBottom: 24 }}>
              {spotlightEntry.nickname?.[0] || "?"}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ textAlign: "center" }}
          >
            <div style={{ fontSize: 48, fontWeight: "bold", marginBottom: 8 }}>{spotlightEntry.nickname}</div>
            <div style={{ fontSize: 36, marginBottom: 24 }}>{spotlightEntry.totalScore.toLocaleString()}点</div>
            <div style={{ fontSize: 18, opacity: 0.8 }}>
              正答率: {accuracyPercent}% / 平均回答速度: {(spotlightEntry.averageResponseTimeMs / 1000).toFixed(2)}秒
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // スクロール表示
  return (
    <div ref={containerRef} style={{ height: "100dvh", overflow: "hidden", background: "#1a1a2e", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: 24 }}>
      <h2 style={{ fontSize: 28, marginBottom: 24, position: "absolute", top: 24 }}>最終結果発表</h2>
      <AnimatePresence>
        {reversed.slice(0, visibleIndex + 1).map((entry) => (
          <motion.div
            key={entry.participantId}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "8px 24px",
              marginBottom: 4,
              fontSize: entry.rank <= 10 ? 20 : 16,
              fontWeight: entry.rank <= 10 ? "bold" : "normal",
            }}
          >
            <span style={{ width: 40, textAlign: "center" }}>{entry.rank}位</span>
            {entry.selfieUrl ? (
              <img src={entry.selfieUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#667eea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {entry.nickname?.[0] || "?"}
              </div>
            )}
            <span style={{ width: 120 }}>{entry.nickname}</span>
            <span>{entry.totalScore.toLocaleString()}点</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
