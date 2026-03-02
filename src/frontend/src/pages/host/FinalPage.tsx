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
  revealTrigger?: number;
  onRevealNext?: () => void;
  onDrumRoll?: () => void;
  onSpotlight?: (rank: number) => void;
};

type RevealPhase = "teamReveal" | "batchScroll" | "finalReveal" | "done" | "group";

type Batch = {
  entries: FinalRankingEntry[];
  speed: number;
};

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

function computeBatches(rankings: FinalRankingEntry[]): Batch[] {
  const fastEntries = rankings.filter((r) => r.rank > 10).sort((a, b) => a.rank - b.rank);

  const batches: Batch[] = [];

  // 高速バッチ: 20人ずつ、下位から（最下位バッチを最初に表示）
  const chunks: FinalRankingEntry[][] = [];
  for (let i = 0; i < fastEntries.length; i += 20) {
    chunks.push(fastEntries.slice(i, i + 20));
  }
  chunks.reverse();
  for (const chunk of chunks) {
    batches.push({ entries: chunk, speed: 150 });
  }

  return batches;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function FinalPage({ data, onReplay, onCloseGame, isDisplay, revealTrigger, onRevealNext, onDrumRoll, onSpotlight }: Props) {
  const hasTeamRankings = (data?.teamRankings?.length ?? 0) > 0;
  const [phase, setPhase] = useState<RevealPhase>(hasTeamRankings ? "teamReveal" : "batchScroll");
  const prefersReducedMotion = useReducedMotion();

  // バッチスクロール状態
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [batchFading, setBatchFading] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);

  // finalReveal: 表示済みの数（末尾=10位から表示していく）
  const [finalVisibleCount, setFinalVisibleCount] = useState(0);
  const finalAutoStartedRef = useRef(false);

  // チーム発表状態
  const [teamRevealIndex, setTeamRevealIndex] = useState(-1);

  const onDrumRollRef = useRef(onDrumRoll);
  onDrumRollRef.current = onDrumRoll;
  const onSpotlightRef = useRef(onSpotlight);
  onSpotlightRef.current = onSpotlight;
  const prevRevealTriggerRef = useRef(revealTrigger ?? 0);

  const { rankings, batches, finalEntries } = useMemo(() => {
    const r = data?.rankings ?? [];
    return {
      rankings: r,
      batches: computeBatches(r),
      // 10位〜1位（rank昇順: 1位が先頭、10位が末尾）
      finalEntries: r.filter((e) => e.rank <= 10).sort((a, b) => a.rank - b.rank),
    };
  }, [data]);

  const sortedTeams = useMemo(
    () => [...(data?.teamRankings ?? [])].sort((a, b) => b.rank - a.rank),
    [data?.teamRankings],
  );

  // --- チームランキング発表フェーズ（現状維持） ---
  useEffect(() => {
    if (phase !== "teamReveal" || sortedTeams.length === 0) return;
    let cancelled = false;
    let i = 0;

    function showNext() {
      if (cancelled || i >= sortedTeams.length) {
        if (!cancelled) {
          if (!prefersReducedMotion) {
            fireConfetti({ particleCount: 150, spread: 100, colors: ["#ffd700", "#ffec8b", "#f59e0b"] });
          }
          setTimeout(() => {
            if (!cancelled) setPhase("batchScroll");
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

  // --- バッチスクロールフェーズ ---
  useEffect(() => {
    if (phase !== "batchScroll") return;

    // バッチがない → 即座にfinalRevealへ
    if (batches.length === 0) {
      setPhase(finalEntries.length > 0 ? "finalReveal" : "done");
      return;
    }

    let cancelled = false;
    const batch = batches[currentBatchIndex];
    if (!batch) {
      setPhase(finalEntries.length > 0 ? "finalReveal" : "done");
      return;
    }

    // 1人ずつめくる（2列でも1人ずつ）
    const total = batch.entries.length;
    let idx = 0;
    setVisibleCount(0);
    setBatchFading(false);

    function showNextPerson() {
      if (cancelled) return;

      if (idx >= total) {
        // 全員表示完了 → 2秒停止 → フェードアウト → 次のバッチ
        setTimeout(() => {
          if (cancelled) return;
          setBatchFading(true);
          setTimeout(() => {
            if (cancelled) return;
            const nextIdx = currentBatchIndex + 1;
            if (nextIdx < batches.length) {
              setCurrentBatchIndex(nextIdx);
              setVisibleCount(0);
              setBatchFading(false);
            } else {
              setPhase(finalEntries.length > 0 ? "finalReveal" : "done");
            }
          }, 500);
        }, 2000);
        return;
      }

      idx++;
      setVisibleCount(idx);
      setTimeout(showNextPerson, batch.speed);
    }

    const initTimer = setTimeout(showNextPerson, 300);
    return () => { cancelled = true; clearTimeout(initTimer); };
  }, [phase, currentBatchIndex, batches, finalEntries.length]);

  // finalReveal: 自動スクロール部分（6〜10位）の数
  const autoCount = useMemo(
    () => finalEntries.filter((e) => e.rank > 5).length,
    [finalEntries],
  );

  // --- finalReveal: 6〜10位を自動スクロール ---
  useEffect(() => {
    if (phase !== "finalReveal") return;
    if (autoCount === 0) return;
    if (finalAutoStartedRef.current) return;
    finalAutoStartedRef.current = true;

    let cancelled = false;
    let count = 0;

    function showNext() {
      if (cancelled) return;
      if (count >= autoCount) return;
      count++;
      setFinalVisibleCount(count);
      setTimeout(showNext, 800);
    }

    const initTimer = setTimeout(showNext, 300);
    return () => { cancelled = true; clearTimeout(initTimer); };
  }, [phase, autoCount]);

  // --- finalReveal: ホストクリックで1個めくる ---
  const revealNextFinal = useCallback(() => {
    if (phase !== "finalReveal") return;
    if (finalVisibleCount < autoCount) return; // まだ自動スクロール中
    if (finalVisibleCount >= finalEntries.length) {
      setPhase("done");
      return;
    }

    // これから表示するエントリ（末尾からfinalVisibleCount番目 → 次はfinalVisibleCount+1番目）
    const nextIdx = finalEntries.length - finalVisibleCount - 1;
    const entry = finalEntries[nextIdx];
    if (entry) {
      onSpotlightRef.current?.(entry.rank);
      fireRankConfetti(entry.rank, prefersReducedMotion);

      // 1位の追加演出: 画面フラッシュ
      if (entry.rank === 1 && !prefersReducedMotion) {
        setFlashVisible(true);
        setTimeout(() => setFlashVisible(false), 300);
      }
    }

    const nextCount = finalVisibleCount + 1;
    setFinalVisibleCount(nextCount);
    if (nextCount >= finalEntries.length) {
      setTimeout(() => setPhase("done"), 3000);
    }
  }, [phase, finalVisibleCount, autoCount, finalEntries, prefersReducedMotion]);

  // --- finalReveal: ホストのボタンクリック（ローカル） ---
  const handleRevealClick = useCallback(() => {
    if (phase !== "finalReveal") return;
    onRevealNext?.();
    revealNextFinal();
  }, [phase, onRevealNext, revealNextFinal]);

  // --- finalReveal: Display側の外部トリガー（ホスト側は直接呼ぶので反応しない） ---
  useEffect(() => {
    const current = revealTrigger ?? 0;
    if (current > prevRevealTriggerRef.current && phase === "finalReveal" && isDisplay) {
      revealNextFinal();
    }
    prevRevealTriggerRef.current = current;
  }, [revealTrigger, phase, revealNextFinal, isDisplay]);

  // --- done → 5秒後に group フェーズへ自動遷移 ---
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("group"), 5000);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!data || rankings.length === 0) return null;

  // ========== チームランキング発表 ==========
  if (phase === "teamReveal" && data.teamRankings) {
    return (
      <div className="h-[100dvh] bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center text-gray-900 p-6">
        <h2 className="font-script text-5xl lg:text-7xl text-amber-800 mb-8 [text-wrap:balance]">チーム結果発表</h2>
        <div className="flex flex-col gap-4 max-w-2xl w-full">
          <AnimatePresence>
            {sortedTeams
              .slice(0, teamRevealIndex + 1)
              .sort((a, b) => a.rank - b.rank)
              .map((team) => {
                const isWinner = team.rank === 1;
                return (
                  <motion.div
                    key={team.teamId}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
                    className={[
                      "flex items-center gap-4 rounded-2xl",
                      isWinner
                        ? "px-10 py-7 bg-gradient-to-r from-amber-200 to-yellow-200 ring-4 ring-amber-400 text-amber-900 shadow-lg"
                        : "px-8 py-5 bg-white/80 text-gray-800",
                    ].join(" ")}
                  >
                    <span className={isWinner ? "text-6xl font-extrabold w-20 text-center" : "text-4xl font-bold w-16 text-center"}>{team.rank}位</span>
                    <span className={isWinner ? "flex-1 text-4xl font-extrabold" : "flex-1 text-2xl font-bold"}>{team.teamName}</span>
                    <span className={isWinner ? "text-4xl font-extrabold [font-variant-numeric:tabular-nums]" : "text-2xl font-bold [font-variant-numeric:tabular-nums]"}>{team.totalScore.toLocaleString()}点</span>
                    <span className={isWinner ? "text-base text-amber-700" : "text-sm text-gray-600"}>{team.memberCount}人</span>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ========== 集合写真フェーズ（現状維持） ==========
  if (phase === "group") {
    return <GroupPhotoView rankings={rankings} onReplay={onReplay} onCloseGame={onCloseGame} isDisplay={isDisplay} prefersReducedMotion={prefersReducedMotion} />;
  }

  // ========== done フェーズ（最後のスポットライト後） ==========
  if (phase === "done") {
    const winner = finalEntries.find((e) => e.rank === 1) ?? rankings[0];
    if (!winner) return null;

    return (
      <div className={`h-[100dvh] flex flex-col items-center justify-center relative ${MEDAL_CLASSES[1]}`}>
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 80 }}
          className="text-5xl md:text-8xl font-extrabold mb-4"
        >
          第1位
        </motion.div>
        {winner.selfieUrl ? (
          <img
            src={winner.selfieUrl}
            alt={`${winner.nickname}のアバター`}
            width={192}
            height={192}
            className="w-48 h-48 rounded-full object-cover mb-6 border-[6px] border-white/50"
          />
        ) : (
          <div className="w-48 h-48 rounded-full flex items-center justify-center text-8xl font-bold mb-6 bg-white/30">
            {winner.nickname?.[0] || "?"}
          </div>
        )}
        <div className="text-3xl md:text-5xl font-bold mb-2">{winner.nickname}</div>
        <div className="text-2xl md:text-4xl mb-6">{winner.totalScore.toLocaleString()}点</div>

        {!isDisplay && (
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
                className="px-8 py-4 rounded-xl bg-primary-light/80 text-primary-dark text-lg font-bold min-h-[44px] hover:bg-primary-light transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                ゲーム終了
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========== batchScroll / finalReveal 共通レイアウト ==========
  const visibleFinal = finalEntries.slice(finalEntries.length - finalVisibleCount);
  const isAutoPhase = finalVisibleCount < autoCount;
  const allRevealed = finalVisibleCount >= finalEntries.length;
  const nextEntry = !allRevealed ? finalEntries[finalEntries.length - finalVisibleCount - 1] : null;

  const currentBatch = batches[currentBatchIndex];
  if (phase === "batchScroll" && !currentBatch) return null;

  const isTwoColumn = currentBatch ? currentBatch.entries.length > 10 : false;
  const halfSize = currentBatch ? Math.ceil(currentBatch.entries.length / 2) : 0;
  const leftCol = isTwoColumn && currentBatch ? currentBatch.entries.slice(0, halfSize) : (currentBatch?.entries ?? []);
  const rightCol = isTwoColumn && currentBatch ? currentBatch.entries.slice(halfSize) : [];

  const visibleRightCount = isTwoColumn ? Math.min(visibleCount, rightCol.length) : 0;
  const visibleLeftCount = isTwoColumn
    ? Math.max(0, visibleCount - rightCol.length)
    : visibleCount;
  const visibleRightEntries = rightCol.slice(rightCol.length - visibleRightCount);
  const visibleLeftEntries = leftCol.slice(leftCol.length - visibleLeftCount);

  return (
    <div className="h-[100dvh] overflow-hidden bg-gradient-to-b from-blush to-white text-gray-900 flex flex-col px-4 pt-1 pb-0">
      {flashVisible && (
        <div className="fixed inset-0 bg-white z-[9999] pointer-events-none motion-safe:animate-screen-flash" />
      )}
      <h2 className="font-script text-4xl text-amber-800 text-center shrink-0 [text-wrap:balance]">最終結果発表</h2>

      {phase === "finalReveal" ? (
        <>
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0">
            <div style={{ flex: finalEntries.length - finalVisibleCount }} />
            {visibleFinal.map((entry) => (
              <div key={entry.participantId} className="flex-1 flex items-center min-h-0">
                <BatchRow entry={entry} highlight={MEDAL_CLASSES[entry.rank]} />
              </div>
            ))}
          </div>

          <div className="text-center h-14 flex items-center justify-center shrink-0">
            {isAutoPhase ? (
              <span className="text-gray-400 text-sm" />
            ) : allRevealed ? (
              <span className="text-gray-600 text-sm">— 全員発表済み —</span>
            ) : (
              <>
                {!isDisplay && (
                  <button
                    type="button"
                    onClick={handleRevealClick}
                    className="px-10 py-4 rounded-2xl bg-amber-500 text-gray-900 text-xl font-extrabold min-h-[44px] hover:bg-amber-400 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    第{nextEntry?.rank}位を発表
                  </button>
                )}
                {isDisplay && (
                  <p className="text-lg text-gray-600">ホストの操作を待っています…</p>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {isTwoColumn ? (
            <div className={`flex-1 flex gap-3 max-w-6xl mx-auto w-full min-h-0 transition-opacity duration-300 ${batchFading ? "opacity-0" : "opacity-100"}`}>
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div style={{ flex: leftCol.length - visibleLeftCount }} />
                {visibleLeftEntries.map((entry) => (
                  <div key={entry.participantId} className="flex-1 flex items-center min-h-0">
                    <BatchRow entry={entry} />
                  </div>
                ))}
              </div>
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div style={{ flex: rightCol.length - visibleRightCount }} />
                {visibleRightEntries.map((entry) => (
                  <div key={entry.participantId} className="flex-1 flex items-center min-h-0">
                    <BatchRow entry={entry} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0 transition-opacity duration-300 ${batchFading ? "opacity-0" : "opacity-100"}`}>
              <div style={{ flex: leftCol.length - visibleLeftCount }} />
              {visibleLeftEntries.map((entry) => (
                <div key={entry.participantId} className="flex-1 flex items-center min-h-0">
                  <BatchRow entry={entry} />
                </div>
              ))}
            </div>
          )}

          <div className={`text-center text-gray-600 text-xs shrink-0 h-6 flex items-center justify-center transition-opacity duration-300 ${batchFading ? "opacity-0" : "opacity-100"}`}>
            {currentBatch && visibleCount >= currentBatch.entries.length && !batchFading && (
              <span>— {currentBatch.entries[0].rank}位〜{currentBatch.entries[currentBatch.entries.length - 1].rank}位 —</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ========== バッチ行コンポーネント ==========

type BatchRowProps = {
  entry: FinalRankingEntry;
  highlight?: string;
};

function BatchRow({ entry, highlight }: BatchRowProps) {
  const bg = highlight ?? (entry.rank % 2 === 0 ? "bg-white/40" : "");
  return (
    <div className={`flex items-center gap-3 px-3 w-full rounded-lg motion-safe:animate-batch-row-in ${bg}`}>
      <span className="w-14 text-xl font-bold text-center [font-variant-numeric:tabular-nums] shrink-0">{entry.rank}位</span>
      {entry.selfieUrl ? (
        <img
          src={entry.selfieUrl}
          alt={`${entry.nickname}のアバター`}
          width={40}
          height={40}
          className={`w-10 h-10 rounded-full object-cover border-2 ${PASTEL_BORDER_CLASSES[entry.rank % PASTEL_BORDER_CLASSES.length]} shrink-0`}
          loading="lazy"
        />
      ) : (
        <div className={`w-10 h-10 rounded-full ${PASTEL_BG_CLASSES[entry.rank % PASTEL_BG_CLASSES.length]} flex items-center justify-center text-base font-bold text-gray-900 shrink-0`}>
          {entry.nickname?.[0] || "?"}
        </div>
      )}
      <span className="flex-1 text-lg font-bold truncate min-w-0">{entry.nickname}</span>
      <span className="text-lg font-bold text-right [font-variant-numeric:tabular-nums] shrink-0">
        {entry.totalScore.toLocaleString()}点
      </span>
      <span className="text-sm text-gray-600 text-right [font-variant-numeric:tabular-nums] shrink-0">
        {(entry.averageResponseTimeMs / 1000).toFixed(2)}秒
      </span>
    </div>
  );
}

// ========== 紙吹雪ヘルパー ==========

function fireRankConfetti(rank: number, prefersReducedMotion: boolean | null) {
  if (prefersReducedMotion) return;
  if (rank === 3) {
    fireConfetti({ particleCount: 50, spread: 60, colors: ["#cd7f32", "#b87333"] });
  } else if (rank === 2) {
    fireConfetti({ particleCount: 100, spread: 80, colors: ["#c0c0c0", "#d4d4d4"] });
  } else if (rank === 1) {
    fireConfetti({ particleCount: 200, spread: 120, colors: ["#ffd700", "#ffec8b", "#ff6347"] });
    setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { x: 0.2 } }), 500);
    setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { x: 0.8 } }), 1000);
    setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { x: 0.3, y: 0.3 } }), 1500);
    setTimeout(() => fireConfetti({ particleCount: 150, spread: 100, origin: { x: 0.7, y: 0.3 } }), 2000);
  }
}

// ========== 集合写真ビュー（現状維持） ==========

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
              <div
                key={entry.participantId}
                className="absolute"
                style={{
                  left: `${config.startX}%`,
                  top: `${config.startY}%`,
                  "--dx": `${config.endX - config.startX}vw`,
                  "--dy": `${config.endY - config.startY}vh`,
                  animationName: "float-avatar",
                  animationDuration: `${config.duration}s`,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDirection: "alternate",
                } as React.CSSProperties}
              >
                <GroupAvatarBubble entry={entry} index={i} />
              </div>
            );
          })}
        </div>
      )}

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
              className="px-8 py-4 rounded-xl bg-primary-light/80 text-primary-dark text-lg font-bold min-h-[44px] hover:bg-primary-light transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
    </div>
  );
}
