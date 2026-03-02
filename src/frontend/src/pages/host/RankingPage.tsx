import { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { RankingData } from "../../types";

type Props = {
  data: RankingData | null;
  onNextQuestion: () => void;
  onEndGame: () => void;
  isDisplay?: boolean;
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

export function RankingPage({ data, onNextQuestion, onEndGame, isDisplay = false }: Props) {
  const top10 = useMemo(() => data?.rankings.slice(0, 10) ?? [], [data]);
  const maxScore = useMemo(() => top10.reduce((max, r) => Math.max(max, r.totalScore), 1), [top10]);
  const teamRankings = data?.teamRankings;
  const teamMaxScore = useMemo(
    () => teamRankings?.reduce((max, t) => Math.max(max, t.totalScore), 1) ?? 1,
    [teamRankings]
  );
  const prefersReducedMotion = useReducedMotion();

  if (!data) return null;

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col text-gray-900 p-6">
      <h2 className="font-script text-5xl lg:text-7xl text-amber-800 text-center mb-4 [text-wrap:balance]">Ranking</h2>

      {/* チームランキング（上位5チーム） */}
      {teamRankings && teamRankings.length > 0 && (
        <div className="mb-4 max-w-4xl mx-auto w-full" role="region" aria-label="チームランキング">
          <h3 className="text-lg font-bold text-amber-700 mb-2 text-center">チームランキング</h3>
          <div className="flex flex-col gap-1.5">
            {teamRankings.slice(0, 5).map((team) => {
              const barWidth = (team.totalScore / teamMaxScore) * 100;
              return (
                <motion.div
                  key={team.teamId}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 80, damping: 15 }}
                  className="flex items-center gap-2"
                >
                  <span className="w-10 text-2xl lg:text-3xl font-bold text-center [font-variant-numeric:tabular-nums]">{team.rank}</span>
                  <span className="w-28 md:w-36 text-lg md:text-xl font-bold truncate">{team.teamName}</span>
                  <div className="flex-1 h-10 lg:h-12 bg-amber-100 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={prefersReducedMotion ? false : { width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 15 }}
                      className="h-full rounded-lg bg-gradient-to-r from-amber-400 to-amber-600"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg lg:text-xl font-bold drop-shadow [font-variant-numeric:tabular-nums]">
                      {team.totalScore.toLocaleString()}点
                    </span>
                  </div>
                  <span className="w-16 text-sm text-gray-700 text-right">{team.memberCount}人</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-2 justify-center max-w-4xl mx-auto w-full" role="region" aria-label="個人ランキング">
        <h3 className="text-lg font-bold text-primary-dark mb-1 text-center">個人ランキング</h3>
        <AnimatePresence>
          {top10.map((entry) => {
            const barWidth = (entry.totalScore / maxScore) * 100;
            const rankChange = entry.previousRank - entry.rank;

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
                <span className="w-12 text-3xl lg:text-4xl font-bold text-center [font-variant-numeric:tabular-nums]">{entry.rank}</span>

                {/* アイコン */}
                {entry.selfieUrl ? (
                  <img
                    src={entry.selfieUrl}
                    alt={`${entry.nickname}のアバター`}
                    width={64}
                    height={64}
                    className={`w-14 h-14 lg:w-16 lg:h-16 rounded-full object-cover border-2 ${PASTEL_BORDER_CLASSES[entry.rank % PASTEL_BORDER_CLASSES.length]} shrink-0`}
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-14 h-14 lg:w-16 lg:h-16 rounded-full ${PASTEL_BG_CLASSES[entry.rank % PASTEL_BG_CLASSES.length]} flex items-center justify-center text-xl lg:text-2xl font-bold text-gray-900 shrink-0`}>
                    {entry.nickname?.[0] || "?"}
                  </div>
                )}

                {/* ニックネーム */}
                <span className="w-24 md:w-36 text-lg md:text-2xl lg:text-3xl font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                  {entry.nickname}
                </span>

                {/* スコアバー */}
                <div className="flex-1 h-12 lg:h-14 bg-primary-light rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 15 }}
                    className="h-full rounded-lg bg-gradient-to-r from-primary to-primary-dark"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg lg:text-2xl font-bold drop-shadow [font-variant-numeric:tabular-nums]">
                    {entry.totalScore.toLocaleString()}点
                  </span>
                </div>

                {/* 順位変動 */}
                <span className="w-12 text-base lg:text-lg font-bold flex items-center justify-center gap-0.5">
                  {rankChange > 0 ? (
                    <span className="flex items-center gap-0.5 text-green-600">
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                        <path d="M6 2L11 8H1z" />
                      </svg>
                      {rankChange}
                    </span>
                  ) : rankChange < 0 ? (
                    <span className="flex items-center gap-0.5 text-red-500">
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                        <path d="M6 10L1 4h10z" />
                      </svg>
                      {Math.abs(rankChange)}
                    </span>
                  ) : null}
                </span>

                {/* 回答速度 */}
                <span className="w-[90px] text-sm lg:text-base text-gray-700 text-right [font-variant-numeric:tabular-nums]">
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
            className="px-8 py-4 rounded-xl bg-primary-light/80 text-primary-dark text-lg font-bold hover:bg-primary-light transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            次の問題
          </button>
          <button
            type="button"
            onClick={onEndGame}
            className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold hover:bg-amber-200 transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            最終結果発表
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
