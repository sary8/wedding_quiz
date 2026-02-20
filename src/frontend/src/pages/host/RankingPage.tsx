import { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { RankingData } from "../../types";

type Props = {
  data: RankingData | null;
  onNextQuestion: () => void;
  onEndGame: () => void;
  isDisplay?: boolean;
};

export function RankingPage({ data, onNextQuestion, onEndGame, isDisplay = false }: Props) {
  const top10 = useMemo(() => data?.rankings.slice(0, 10) ?? [], [data?.rankings]);
  const maxScore = useMemo(() => top10.reduce((max, r) => Math.max(max, r.totalScore), 1), [top10]);
  const prefersReducedMotion = useReducedMotion();

  if (!data) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-blush to-white text-gray-900 p-6">
      <h2 className="font-script text-4xl text-amber-800 text-center mb-6">Ranking</h2>

      <div className="flex-1 flex flex-col gap-2 justify-center max-w-4xl mx-auto w-full" aria-live="polite" aria-label="ランキング">
        <AnimatePresence>
          {top10.map((entry) => {
            const barWidth = (entry.totalScore / maxScore) * 100;
            const rankChange = entry.previousRank - entry.rank;
            const changeText = rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : "";
            const changeColorClass = rankChange > 0 ? "text-green-600" : rankChange < 0 ? "text-red-500" : "text-transparent";

            return (
              <motion.div
                key={entry.participantId}
                layout={!prefersReducedMotion}
                initial={prefersReducedMotion ? false : { opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 80, damping: 15, duration: 1.5 }}
                className="flex items-center gap-2 md:gap-3"
              >
                {/* 順位 */}
                <span className="w-10 text-2xl font-bold text-center">{entry.rank}</span>

                {/* アイコン */}
                {entry.selfieUrl ? (
                  <img
                    src={entry.selfieUrl}
                    alt={`${entry.nickname}のアバター`}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-white shrink-0">
                    {entry.nickname?.[0] || "?"}
                  </div>
                )}

                {/* ニックネーム */}
                <span className="w-20 md:w-28 text-sm md:text-base font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                  {entry.nickname}
                </span>

                {/* スコアバー */}
                <div className="flex-1 h-9 bg-gray-900/10 rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 15 }}
                    className="h-full rounded-lg bg-gradient-to-r from-primary to-primary-dark"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold drop-shadow">
                    {entry.totalScore.toLocaleString()}点
                  </span>
                </div>

                {/* 順位変動 */}
                <span className={`w-10 text-sm font-bold text-center ${changeColorClass}`}>
                  {changeText}
                </span>

                {/* 回答速度 */}
                <span className="w-[70px] text-xs text-gray-500 text-right">
                  {entry.lastResponseTimeMs != null
                    ? `${(entry.lastResponseTimeMs / 1000).toFixed(2)}秒`
                    : "---"}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!isDisplay && (
        <div className="flex gap-4 justify-center mt-6">
          <button
            type="button"
            onClick={onNextQuestion}
            className="px-8 py-4 rounded-xl bg-gray-900/10 text-gray-900 text-lg font-bold hover:bg-gray-900/15 transition-colors duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30"
          >
            次の問題
          </button>
          <button
            type="button"
            onClick={onEndGame}
            className="px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/30"
          >
            最終結果発表
          </button>
        </div>
      )}
    </div>
  );
}
