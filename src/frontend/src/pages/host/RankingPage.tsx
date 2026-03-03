import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { RankingData } from "../../types";

const ITEMS_PER_PAGE = 10;

type RankingViewMode = "individual" | "team";

type Props = {
  data: RankingData | null;
  onNextQuestion: () => void;
  onEndGame: () => void;
  isDisplay?: boolean;
  rankingPage?: number;
  rankingMode?: RankingViewMode;
  onRankingViewChange?: (page: number, mode: RankingViewMode) => void;
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

function rankColorClass(rank: number): string {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-gray-900";
}

const MOTION_BAR_INITIAL = { width: 0 } as const;
const MOTION_BAR_TRANSITION = { type: "spring", stiffness: 60, damping: 15 } as const;
const MOTION_INSTANT = { duration: 0 } as const;

export function RankingPage({ data, onNextQuestion, onEndGame, isDisplay = false, rankingPage: externalPage, rankingMode: externalMode, onRankingViewChange }: Props) {
  const teamRankings = data?.teamRankings ?? [];
  const hasTeams = teamRankings.length > 0;

  // モード管理: ホストはローカルstate、Displayは外部propで制御
  const [localMode, setLocalMode] = useState<RankingViewMode>("individual");
  const currentMode = isDisplay ? (externalMode ?? "individual") : localMode;

  // ページ管理（個人・チームそれぞれ）
  const [individualPage, setIndividualPage] = useState(0);
  const [teamPage, setTeamPage] = useState(0);
  const currentPage = isDisplay
    ? (externalPage ?? 0)
    : (currentMode === "individual" ? individualPage : teamPage);

  // エントリ計算
  const allRankings = data?.rankings ?? [];
  const totalIndividual = allRankings.length;
  const totalTeam = teamRankings.length;
  const totalIndividualPages = Math.max(1, Math.ceil(totalIndividual / ITEMS_PER_PAGE));
  const totalTeamPages = Math.max(1, Math.ceil(totalTeam / ITEMS_PER_PAGE));
  const totalPages = currentMode === "individual" ? totalIndividualPages : totalTeamPages;
  const totalItems = currentMode === "individual" ? totalIndividual : totalTeam;

  const individualEntries = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return allRankings.slice(start, start + ITEMS_PER_PAGE);
  }, [allRankings, currentPage]);

  const teamEntries = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return teamRankings.slice(start, start + ITEMS_PER_PAGE);
  }, [teamRankings, currentPage]);

  // バーの基準スコア: maxPossibleScore（満点）があればそれを使う。なければ全体maxにフォールバック
  const maxPossible = data?.maxPossibleScore;
  const individualMaxScore = maxPossible && maxPossible > 0
    ? maxPossible
    : allRankings.reduce((max, r) => Math.max(max, r.totalScore), 1);
  // チームの満点 = 個人満点 × メンバー数（不明なので全体maxにフォールバック）
  const teamMaxScore = teamRankings.reduce((max, t) => Math.max(max, t.totalScore), 1);

  const prefersReducedMotion = useReducedMotion();

  // --- ハンドラ ---
  const emitViewChange = useCallback((mode: RankingViewMode, page: number) => {
    onRankingViewChange?.(page, mode);
  }, [onRankingViewChange]);

  const handlePageChange = useCallback((page: number) => {
    if (currentMode === "individual") {
      setIndividualPage(page);
    } else {
      setTeamPage(page);
    }
    emitViewChange(currentMode, page);
  }, [currentMode, emitViewChange]);

  const handleShowTeamRanking = useCallback(() => {
    setLocalMode("team");
    setTeamPage(0);
    emitViewChange("team", 0);
  }, [emitViewChange]);

  const handleBackToIndividual = useCallback(() => {
    setLocalMode("individual");
    emitViewChange("individual", individualPage);
  }, [emitViewChange, individualPage]);

  if (!data) return null;

  // ページ情報テキスト
  const unitLabel = currentMode === "individual" ? "人" : "チーム";
  const pageStart = currentPage * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalItems);
  const pageInfoText = `${pageStart}〜${pageEnd}位 / 全${totalItems}${unitLabel}`;

  // 見出し
  const heading = hasTeams
    ? (currentMode === "individual" ? "Individual Ranking" : "Team Ranking")
    : "Ranking";

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col text-gray-900 px-6 py-6">
      <h2 className="font-script text-5xl lg:text-7xl text-amber-800 text-center mb-4 shrink-0 [text-wrap:balance]">{heading}</h2>

      {/* メインリスト */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full min-h-0" role="region" aria-label={heading}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentMode}-${currentPage}`}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col gap-2.5 justify-center"
          >
            {currentMode === "individual" ? (
              /* === 個人ランキング === */
              individualEntries.map((entry) => {
                const barWidth = (entry.totalScore / individualMaxScore) * 100;
                const rankChange = entry.previousRank - entry.rank;
                return (
                  <div key={entry.participantId} className="flex items-center gap-2.5">
                    <span className={`w-12 text-3xl lg:text-4xl font-bold text-center shrink-0 [font-variant-numeric:tabular-nums] ${rankColorClass(entry.rank)}`}>{entry.rank}</span>
                    {entry.selfieUrl ? (
                      <img
                        src={entry.selfieUrl}
                        alt={`${entry.nickname}のアバター`}
                        width={48}
                        height={48}
                        className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full object-cover border-2 ${PASTEL_BORDER_CLASSES[entry.rank % PASTEL_BORDER_CLASSES.length]} shrink-0`}
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full ${PASTEL_BG_CLASSES[entry.rank % PASTEL_BG_CLASSES.length]} flex items-center justify-center text-base lg:text-lg font-bold text-gray-900 shrink-0`}>
                        {entry.nickname?.[0] || "?"}
                      </div>
                    )}
                    <span className="w-[8.5em] text-xl lg:text-3xl font-bold overflow-hidden text-ellipsis whitespace-nowrap shrink-0">
                      {entry.nickname}
                    </span>
                    <div className="flex-1 h-12 lg:h-14 bg-primary-light rounded-lg overflow-hidden">
                      <motion.div
                        initial={prefersReducedMotion ? false : MOTION_BAR_INITIAL}
                        animate={{ width: `${barWidth}%` }}
                        transition={prefersReducedMotion ? MOTION_INSTANT : MOTION_BAR_TRANSITION}
                        className="h-full rounded-lg bg-gradient-to-r from-primary to-primary-dark"
                      />
                    </div>
                    <span className="whitespace-nowrap text-lg lg:text-2xl font-extrabold text-gray-900 text-right shrink-0 [font-variant-numeric:tabular-nums]">
                      {entry.totalScore.toLocaleString()} <span className="text-sm lg:text-base">pts</span>
                    </span>
                    <span className="w-14 text-lg lg:text-xl font-bold flex items-center justify-center gap-0.5 shrink-0">
                      {rankChange > 0 ? (
                        <span className="flex items-center gap-0.5 text-green-500">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 2L11 8H1z" />
                          </svg>
                          {rankChange}
                        </span>
                      ) : rankChange < 0 ? (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 10L1 4h10z" />
                          </svg>
                          {Math.abs(rankChange)}
                        </span>
                      ) : null}
                    </span>
                    <span className="w-[70px] text-sm lg:text-base font-semibold text-gray-600 text-right shrink-0 [font-variant-numeric:tabular-nums]">
                      {entry.lastResponseTimeMs != null
                        ? `${(entry.lastResponseTimeMs / 1000).toFixed(2)}s`
                        : "---"}
                    </span>
                  </div>
                );
              })
            ) : (
              /* === チームランキング === */
              teamEntries.map((team) => {
                const barWidth = (team.totalScore / teamMaxScore) * 100;
                const rankChange = (team.previousRank ?? team.rank) - team.rank;
                return (
                  <div key={team.teamId} className="flex items-center gap-2.5">
                    <span className={`w-12 text-3xl lg:text-4xl font-bold text-center shrink-0 [font-variant-numeric:tabular-nums] ${rankColorClass(team.rank)}`}>{team.rank}</span>
                    <span className="w-[8.5em] text-xl lg:text-3xl font-bold overflow-hidden text-ellipsis whitespace-nowrap shrink-0">{team.teamName}</span>
                    <div className="flex-1 h-12 lg:h-14 bg-amber-100 rounded-lg overflow-hidden">
                      <motion.div
                        initial={prefersReducedMotion ? false : MOTION_BAR_INITIAL}
                        animate={{ width: `${barWidth}%` }}
                        transition={prefersReducedMotion ? MOTION_INSTANT : MOTION_BAR_TRANSITION}
                        className="h-full rounded-lg bg-gradient-to-r from-amber-400 to-amber-600"
                      />
                    </div>
                    <span className="whitespace-nowrap text-lg lg:text-2xl font-extrabold text-gray-900 text-right shrink-0 [font-variant-numeric:tabular-nums]">
                      {team.totalScore.toLocaleString()} <span className="text-sm lg:text-base">pts</span>
                    </span>
                    <span className="w-14 text-lg lg:text-xl font-bold flex items-center justify-center gap-0.5 shrink-0">
                      {rankChange > 0 ? (
                        <span className="flex items-center gap-0.5 text-green-500">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 2L11 8H1z" />
                          </svg>
                          {rankChange}
                        </span>
                      ) : rankChange < 0 ? (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 10L1 4h10z" />
                          </svg>
                          {Math.abs(rankChange)}
                        </span>
                      ) : null}
                    </span>
                    <span className="w-[50px] text-sm lg:text-base font-semibold text-gray-600 text-right shrink-0">{team.memberCount}人</span>
                  </div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Display用: ページ情報 */}
      {isDisplay && totalPages > 1 && (
        <p className="text-center text-lg font-semibold text-gray-600 mt-4 shrink-0">{pageInfoText}</p>
      )}

      {/* ホスト操作パネル */}
      {!isDisplay && (
        <div className="flex flex-col gap-3 items-center mt-6 shrink-0">
          {/* ページ切り替え */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage <= 0}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-base font-bold hover:bg-gray-300 transition-colors duration-200 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                ← 前の10{unitLabel}
              </button>
              <span className="text-base text-gray-600 [font-variant-numeric:tabular-nums]">{pageInfoText}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-base font-bold hover:bg-gray-300 transition-colors duration-200 min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                次の10{unitLabel} →
              </button>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            {/* 個人モード: チームランキング表示ボタン（チーム戦のみ） */}
            {currentMode === "individual" && hasTeams && (
              <button
                type="button"
                onClick={handleShowTeamRanking}
                className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold hover:bg-amber-200 transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                チームランキングを表示
              </button>
            )}

            {/* 個人モード（チーム戦なし）: 次の問題 + 最終結果発表 */}
            {currentMode === "individual" && !hasTeams && (
              <>
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
              </>
            )}

            {/* チームモード: 個人に戻る + 次の問題 + 最終結果発表 */}
            {currentMode === "team" && (
              <>
                <button
                  type="button"
                  onClick={handleBackToIndividual}
                  className="px-6 py-4 rounded-xl bg-gray-200 text-gray-700 text-lg font-bold hover:bg-gray-300 transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  個人ランキングに戻る
                </button>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
