import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  if (!data) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-dark to-[#16213e] text-white p-6">
      <h2 className="font-script text-4xl text-accent text-center mb-6">Ranking</h2>

      <div className="flex-1 flex flex-col gap-2 justify-center max-w-4xl mx-auto w-full">
        <AnimatePresence>
          {top10.map((entry) => {
            const barWidth = (entry.totalScore / maxScore) * 100;
            const rankChange = entry.previousRank - entry.rank;
            const changeText = rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : "";
            const changeColor = rankChange > 0 ? "#4caf50" : rankChange < 0 ? "#ef5350" : "transparent";

            return (
              <motion.div
                key={entry.participantId}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 80, damping: 15, duration: 1.5 }}
                className="flex items-center gap-3"
              >
                {/* 順位 */}
                <span className="w-10 text-2xl font-bold text-center">{entry.rank}</span>

                {/* アイコン */}
                {entry.selfieUrl ? (
                  <img
                    src={entry.selfieUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-xl font-bold shrink-0">
                    {entry.nickname?.[0] || "?"}
                  </div>
                )}

                {/* ニックネーム */}
                <span className="w-24 text-base font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                  {entry.nickname}
                </span>

                {/* スコアバー */}
                <div className="flex-1 h-9 bg-white/10 rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 15 }}
                    className="h-full rounded-lg bg-gradient-to-r from-primary to-primary-dark"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold drop-shadow">
                    {entry.totalScore.toLocaleString()}点
                  </span>
                </div>

                {/* 順位変動 */}
                <span className="w-10 text-sm font-bold text-center" style={{ color: changeColor }}>
                  {changeText}
                </span>

                {/* 回答速度 */}
                <span className="w-[70px] text-xs text-gray-400 text-right">
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
            className="px-8 py-4 rounded-xl bg-white/20 text-white text-lg font-bold hover:bg-white/30 transition-colors duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            次の問題
          </button>
          <button
            type="button"
            onClick={onEndGame}
            className="px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            最終結果発表
          </button>
        </div>
      )}
    </div>
  );
}
