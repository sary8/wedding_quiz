import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { RankingData } from "../../types";

const ITEMS_PER_PAGE = 10;

type Props = {
  data: RankingData | null;
  onNextQuestion: () => void;
  onEndGame: () => void;
  isDisplay?: boolean;
  rankingPage?: number;
  onSetRankingPage?: (page: number) => void;
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

// framer-motion アニメーション定数（インラインオブジェクト回避）
const MOTION_TEAM_INITIAL = { opacity: 0, x: -30 } as const;
const MOTION_TEAM_ANIMATE = { opacity: 1, x: 0 } as const;
const MOTION_TEAM_TRANSITION = { type: "spring", stiffness: 80, damping: 15 } as const;
const MOTION_TEAM_BAR_INITIAL = { width: 0 } as const;
const MOTION_BAR_TRANSITION = { type: "spring", stiffness: 60, damping: 15 } as const;
const MOTION_ENTRY_INITIAL = { opacity: 0, x: -50 } as const;
const MOTION_ENTRY_ANIMATE = { opacity: 1, x: 0 } as const;
const MOTION_ENTRY_TRANSITION = { type: "spring", stiffness: 80, damping: 15, duration: 1.5 } as const;
const MOTION_INSTANT = { duration: 0 } as const;

export function RankingPage({ data, onNextQuestion, onEndGame, isDisplay = false, rankingPage: externalPage, onSetRankingPage }: Props) {
  const teamRankings = data?.teamRankings;
  const hasTeams = (teamRankings?.length ?? 0) > 0;

  // ページ管理: ホストはローカルstate、Displayは外部propで制御
  const [localPage, setLocalPage] = useState(0);
  const currentPage = isDisplay ? (externalPage ?? 0) : localPage;

  const totalRankings = data?.rankings.length ?? 0;
  const totalPages = hasTeams ? 1 : Math.max(1, Math.ceil(totalRankings / ITEMS_PER_PAGE));

  const individualEntries = useMemo(() => {
    if (hasTeams) {
      return data?.rankings.slice(0, 5) ?? [];
    }
    const start = currentPage * ITEMS_PER_PAGE;
    return data?.rankings.slice(start, start + ITEMS_PER_PAGE) ?? [];
  }, [data, hasTeams, currentPage]);

  const maxScore = useMemo(() => {
    // 全体の最高スコアを基準にする（ページ間でバーの比較が一貫するように）
    if (hasTeams) {
      return individualEntries.reduce((max, r) => Math.max(max, r.totalScore), 1);
    }
    return data?.rankings.reduce((max, r) => Math.max(max, r.totalScore), 1) ?? 1;
  }, [data, individualEntries, hasTeams]);

  const handlePageChange = useCallback((page: number) => {
    setLocalPage(page);
    onSetRankingPage?.(page);
  }, [onSetRankingPage]);
  const teamMaxScore = useMemo(
    () => teamRankings?.reduce((max, t) => Math.max(max, t.totalScore), 1) ?? 1,
    [teamRankings]
  );
  const prefersReducedMotion = useReducedMotion();

  if (!data) return null;

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col text-gray-900 px-6 py-6">
      <h2 className="font-script text-5xl lg:text-7xl text-amber-800 text-center mb-4 shrink-0 [text-wrap:balance]">Ranking</h2>

      {/* チームランキング（上位5チーム） */}
      {teamRankings && teamRankings.length > 0 && (
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0" role="region" aria-label="Team Ranking">
          <h3 className="text-lg font-bold text-amber-700 mb-2 text-center shrink-0">Team Ranking</h3>
          <div className="flex-1 flex flex-col gap-2 justify-center">
            {teamRankings.slice(0, 5).map((team) => {
              const barWidth = (team.totalScore / teamMaxScore) * 100;
              return (
                <motion.div
                  key={team.teamId}
                  initial={prefersReducedMotion ? false : MOTION_TEAM_INITIAL}
                  animate={MOTION_TEAM_ANIMATE}
                  transition={prefersReducedMotion ? MOTION_INSTANT : MOTION_TEAM_TRANSITION}
                  className="flex items-center gap-2"
                >
                  <span className="w-10 text-2xl lg:text-3xl font-bold text-center [font-variant-numeric:tabular-nums]">{team.rank}</span>
                  <span className="w-28 md:w-36 text-lg md:text-xl font-bold truncate">{team.teamName}</span>
                  <div className="flex-1 h-10 lg:h-12 bg-amber-100 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={prefersReducedMotion ? false : MOTION_TEAM_BAR_INITIAL}
                      animate={{ width: `${barWidth}%` }}
                      transition={prefersReducedMotion ? MOTION_INSTANT : MOTION_BAR_TRANSITION}
                      className="h-full rounded-lg bg-gradient-to-r from-amber-400 to-amber-600"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg lg:text-xl font-bold drop-shadow [font-variant-numeric:tabular-nums]">
                      {team.totalScore.toLocaleString()} pts
                    </span>
                  </div>
                  <span className="w-16 text-sm text-gray-700 text-right">{team.memberCount} members</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0" role="region" aria-label="Individual Ranking">
        {hasTeams && <h3 className="text-lg font-bold text-primary-dark mb-2 text-center shrink-0">Individual Ranking</h3>}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col gap-2 justify-center"
          >
          {individualEntries.map((entry) => {
            const barWidth = (entry.totalScore / maxScore) * 100;
            const rankChange = entry.previousRank - entry.rank;

            return (
              <div
                key={entry.participantId}
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
                    initial={prefersReducedMotion ? false : MOTION_TEAM_BAR_INITIAL}
                    animate={{ width: `${barWidth}%` }}
                    transition={prefersReducedMotion ? MOTION_INSTANT : MOTION_BAR_TRANSITION}
                    className="h-full rounded-lg bg-gradient-to-r from-primary to-primary-dark"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg lg:text-2xl font-bold drop-shadow [font-variant-numeric:tabular-nums]">
                    {entry.totalScore.toLocaleString()} pts
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
                    ? `${(entry.lastResponseTimeMs / 1000).toFixed(2)}s`
                    : "---"}
                </span>
              </div>
            );
          })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Display用: ページ表示（チーム戦でなく複数ページの場合） */}
      {isDisplay && !hasTeams && totalPages > 1 && (
        <p className="text-center text-base text-gray-500 mt-2 shrink-0">
          {currentPage * ITEMS_PER_PAGE + 1}〜{Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalRankings)}位 / 全{totalRankings}人
        </p>
      )}

      {!isDisplay && (
        <div className="flex flex-col gap-3 items-center mt-4 shrink-0">
          {/* ページ切り替え（個人戦で複数ページある場合のみ） */}
          {!hasTeams && totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage <= 0}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-base font-bold hover:bg-gray-300 transition-colors duration-200 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                ← 前の10人
              </button>
              <span className="text-base text-gray-600 [font-variant-numeric:tabular-nums]">
                {currentPage * ITEMS_PER_PAGE + 1}〜{Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalRankings)}位 / 全{totalRankings}人
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-base font-bold hover:bg-gray-300 transition-colors duration-200 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                次の10人 →
              </button>
            </div>
          )}

          <div className="flex gap-4 justify-center">
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
        </div>
      )}
    </div>
    </div>
  );
}
