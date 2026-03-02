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

type RevealPhase = "teamReveal" | "batchScroll" | "top5" | "done" | "group";

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
  const rest = rankings.filter((r) => r.rank > 5).sort((a, b) => a.rank - b.rank);
  const slowEntries = rest.filter((r) => r.rank <= 10);
  const fastEntries = rest.filter((r) => r.rank > 10);

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

  // 低速バッチ: 10位〜6位
  if (slowEntries.length > 0) {
    batches.push({ entries: slowEntries, speed: 800 });
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
  const [visibleRowCount, setVisibleRowCount] = useState(0);
  const [batchFading, setBatchFading] = useState(false);

  // Top5: 表示済みの数（0=まだ誰も表示していない、1=5位を表示済み、…）
  const [top5VisibleCount, setTop5VisibleCount] = useState(0);

  // チーム発表状態
  const [teamRevealIndex, setTeamRevealIndex] = useState(-1);

  const onDrumRollRef = useRef(onDrumRoll);
  onDrumRollRef.current = onDrumRoll;
  const onSpotlightRef = useRef(onSpotlight);
  onSpotlightRef.current = onSpotlight;
  const prevRevealTriggerRef = useRef(revealTrigger ?? 0);

  const { rankings, batches, top5 } = useMemo(() => {
    const r = data?.rankings ?? [];
    return {
      rankings: r,
      batches: computeBatches(r),
      top5: r.filter((e) => e.rank <= 5).sort((a, b) => b.rank - a.rank),
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

    // バッチがない（全員Top5内）→ 即座にTop5へ
    if (batches.length === 0) {
      setPhase(top5.length > 0 ? "top5" : "done");
      return;
    }

    let cancelled = false;
    const batch = batches[currentBatchIndex];
    if (!batch) {
      setPhase(top5.length > 0 ? "top5" : "done");
      return;
    }

    const isTwoCol = batch.entries.length > 10;
    const rowTotal = isTwoCol ? Math.ceil(batch.entries.length / 2) : batch.entries.length;
    let rowIdx = 0;
    setVisibleRowCount(0);
    setBatchFading(false);

    function showNextRow() {
      if (cancelled) return;

      if (rowIdx >= rowTotal) {
        // 全行表示完了 → 2秒停止 → フェードアウト → 次のバッチ
        setTimeout(() => {
          if (cancelled) return;
          setBatchFading(true);
          setTimeout(() => {
            if (cancelled) return;
            const nextIdx = currentBatchIndex + 1;
            if (nextIdx < batches.length) {
              setCurrentBatchIndex(nextIdx);
              setVisibleRowCount(0);
              setBatchFading(false);
            } else {
              setPhase(top5.length > 0 ? "top5" : "done");
            }
          }, 500); // フェードアウト時間
        }, 2000); // 停止時間
        return;
      }

      rowIdx++;
      setVisibleRowCount(rowIdx);
      setTimeout(showNextRow, batch.speed);
    }

    const initTimer = setTimeout(showNextRow, 300);
    return () => { cancelled = true; clearTimeout(initTimer); };
  }, [phase, currentBatchIndex, batches, top5.length]);

  // --- Top5: 1個ずつめくる ---
  const revealNextTop5 = useCallback(() => {
    if (phase !== "top5") return;
    if (top5VisibleCount >= top5.length) {
      setPhase("done");
      return;
    }
    const entry = top5[top5VisibleCount];
    onSpotlightRef.current?.(entry.rank);
    fireRankConfetti(entry.rank, prefersReducedMotion);

    // 1位の追加演出: 画面フラッシュ
    if (entry.rank === 1 && !prefersReducedMotion) {
      const flash = document.createElement("div");
      flash.className = "fixed inset-0 bg-white z-[9999] pointer-events-none opacity-80 transition-opacity duration-200";
      document.body.appendChild(flash);
      setTimeout(() => { flash.style.opacity = "0"; }, 50);
      setTimeout(() => { flash.remove(); }, 300);
    }

    const nextCount = top5VisibleCount + 1;
    setTop5VisibleCount(nextCount);
    if (nextCount >= top5.length) {
      setTimeout(() => setPhase("done"), 3000);
    }
  }, [phase, top5VisibleCount, top5, prefersReducedMotion]);

  // --- Top5: ホストのボタンクリック（ローカル） ---
  const handleRevealClick = useCallback(() => {
    if (phase !== "top5") return;
    onRevealNext?.();
    revealNextTop5();
  }, [phase, onRevealNext, revealNextTop5]);

  // --- Top5: Display側の外部トリガー ---
  useEffect(() => {
    const current = revealTrigger ?? 0;
    if (current > prevRevealTriggerRef.current && phase === "top5") {
      revealNextTop5();
    }
    prevRevealTriggerRef.current = current;
  }, [revealTrigger, phase, revealNextTop5]);

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

  // ========== Top5 ランキング行形式 ==========
  if (phase === "top5") {
    const visibleTop5 = top5.slice(0, top5VisibleCount);

    return (
      <div className="h-[100dvh] overflow-hidden bg-gradient-to-b from-blush to-white text-gray-900 flex flex-col p-6">
        <h2 className="font-script text-4xl lg:text-6xl text-amber-800 text-center mb-4 [text-wrap:balance]">Top 5 発表</h2>

        <div className="flex-1 flex flex-col justify-end gap-1 max-w-4xl mx-auto w-full overflow-hidden">
          <AnimatePresence>
            {visibleTop5.map((entry) => {
              const medalClass = MEDAL_CLASSES[entry.rank];
              return (
                <motion.div
                  key={entry.participantId}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
                  className={`flex items-center gap-2 md:gap-3 px-3 py-2 rounded-lg ${medalClass ?? "even:bg-white/40"}`}
                >
                  <span className="w-14 text-2xl font-extrabold text-center [font-variant-numeric:tabular-nums] shrink-0">{entry.rank}位</span>
                  {entry.selfieUrl ? (
                    <img
                      src={entry.selfieUrl}
                      alt={`${entry.nickname}のアバター`}
                      width={44}
                      height={44}
                      className={`w-11 h-11 rounded-full object-cover border-2 ${PASTEL_BORDER_CLASSES[entry.rank % PASTEL_BORDER_CLASSES.length]} shrink-0`}
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-11 h-11 rounded-full ${PASTEL_BG_CLASSES[entry.rank % PASTEL_BG_CLASSES.length]} flex items-center justify-center text-lg font-bold text-gray-900 shrink-0`}>
                      {entry.nickname?.[0] || "?"}
                    </div>
                  )}
                  <span className="flex-1 text-xl md:text-2xl font-bold truncate">{entry.nickname}</span>
                  <span className="w-28 text-xl font-bold text-right [font-variant-numeric:tabular-nums] shrink-0">
                    {entry.totalScore.toLocaleString()}点
                  </span>
                  <span className="w-28 text-sm text-gray-600 text-right [font-variant-numeric:tabular-nums] shrink-0">
                    avg {(entry.averageResponseTimeMs / 1000).toFixed(2)}秒
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ホスト操作ボタン */}
        <div className="text-center mt-4">
          {top5VisibleCount < top5.length ? (
            <>
              {!isDisplay && (
                <button
                  type="button"
                  onClick={handleRevealClick}
                  className="px-10 py-4 rounded-2xl bg-amber-500 text-gray-900 text-xl font-extrabold min-h-[44px] hover:bg-amber-400 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 motion-safe:animate-pulse"
                >
                  第{top5[top5VisibleCount]?.rank}位を発表
                </button>
              )}
              {isDisplay && (
                <p className="text-lg text-gray-400">ホストの操作を待っています…</p>
              )}
            </>
          ) : (
            <span className="text-gray-500 text-sm">— 全員発表済み —</span>
          )}
        </div>
      </div>
    );
  }

  // ========== done フェーズ（最後のスポットライト後） ==========
  if (phase === "done") {
    const winner = top5.find((e) => e.rank === 1) ?? rankings[0];
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

  // ========== バッチスクロール表示 ==========
  const currentBatch = batches[currentBatchIndex];
  if (!currentBatch) return null;

  const isTwoColumn = currentBatch.entries.length > 10;
  const halfSize = Math.ceil(currentBatch.entries.length / 2);
  // 左列: 上位（例: 81〜90位）、右列: 下位（例: 91〜100位）
  const leftCol = isTwoColumn ? currentBatch.entries.slice(0, halfSize) : currentBatch.entries;
  const rightCol = isTwoColumn ? currentBatch.entries.slice(halfSize) : [];

  // visibleRowCountは「行」単位（2列の場合、1行=左右1個ずつ）
  // 最下位行から表示するため、末尾からvisibleRowCount個
  const visibleLeftEntries = leftCol.slice(leftCol.length - visibleRowCount);
  const visibleRightEntries = isTwoColumn ? rightCol.slice(rightCol.length - visibleRowCount) : [];

  return (
    <motion.div
      animate={{ opacity: batchFading ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="h-[100dvh] overflow-hidden bg-gradient-to-b from-blush to-white text-gray-900 flex flex-col p-6"
    >
      <h2 className="font-script text-4xl lg:text-6xl text-amber-800 text-center mb-4 [text-wrap:balance]">最終結果発表</h2>

      {/* バッチ内容 */}
      {isTwoColumn ? (
        <div className="flex-1 flex gap-4 max-w-6xl mx-auto w-full overflow-hidden">
          {/* 左列（上位） */}
          <div className="flex-1 flex flex-col justify-end gap-1 overflow-hidden">
            <AnimatePresence>
              {visibleLeftEntries.map((entry) => (
                <BatchRow key={entry.participantId} entry={entry} prefersReducedMotion={prefersReducedMotion} />
              ))}
            </AnimatePresence>
          </div>
          {/* 右列（下位） */}
          <div className="flex-1 flex flex-col justify-end gap-1 overflow-hidden">
            <AnimatePresence>
              {visibleRightEntries.map((entry) => (
                <BatchRow key={entry.participantId} entry={entry} prefersReducedMotion={prefersReducedMotion} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-end gap-1 max-w-4xl mx-auto w-full overflow-hidden">
          <AnimatePresence>
            {visibleLeftEntries.map((entry) => (
              <BatchRow key={entry.participantId} entry={entry} prefersReducedMotion={prefersReducedMotion} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* バッチラベル */}
      <div className="text-center mt-3 text-gray-500 text-sm">
        {visibleRowCount >= (isTwoColumn ? Math.max(leftCol.length, rightCol.length) : currentBatch.entries.length) && !batchFading && (
          <span>— {currentBatch.entries[0].rank}位〜{currentBatch.entries[currentBatch.entries.length - 1].rank}位 —</span>
        )}
      </div>
    </motion.div>
  );
}

// ========== バッチ行コンポーネント ==========

type BatchRowProps = {
  entry: FinalRankingEntry;
  prefersReducedMotion: boolean | null;
};

function BatchRow({ entry, prefersReducedMotion }: BatchRowProps) {
  return (
    <motion.div
      key={entry.participantId}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
      className="flex items-center gap-2 md:gap-3 px-3 py-1.5 even:bg-white/40 rounded-lg"
    >
      <span className="w-14 text-xl font-bold text-center [font-variant-numeric:tabular-nums] shrink-0">{entry.rank}位</span>
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
        <div className={`w-9 h-9 rounded-full ${PASTEL_BG_CLASSES[entry.rank % PASTEL_BG_CLASSES.length]} flex items-center justify-center text-sm font-bold text-gray-900 shrink-0`}>
          {entry.nickname?.[0] || "?"}
        </div>
      )}
      <span className="flex-1 text-lg md:text-xl font-bold truncate">{entry.nickname}</span>
      <span className="w-24 text-lg font-bold text-right [font-variant-numeric:tabular-nums] shrink-0">
        {entry.totalScore.toLocaleString()}点
      </span>
      <span className="w-28 text-sm text-gray-600 text-right [font-variant-numeric:tabular-nums] shrink-0">
        avg {(entry.averageResponseTimeMs / 1000).toFixed(2)}秒
      </span>
    </motion.div>
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
