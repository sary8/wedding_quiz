import { useState, useEffect } from "react";
import type { QuizSummary, QuizStatsData, QuestionStats, ParticipantStatsEntry, Difficulty } from "../../types";
import { QuizStatus } from "../../types";
import { getQuizStats } from "../../services/api";
import { cn } from "../../utils/cn";

type Props = {
  quizList: QuizSummary[];
};

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "易",
  normal: "普通",
  hard: "難",
  very_hard: "超難",
};

const DIFFICULTY_CLASSES: Record<Difficulty, string> = {
  easy: "bg-green-100 text-green-700",
  normal: "bg-yellow-100 text-yellow-700",
  hard: "bg-orange-100 text-orange-700",
  very_hard: "bg-red-100 text-red-700",
};

const RATE_BAR_CLASSES = [
  "bg-choice-rose",
  "bg-choice-sky",
  "bg-choice-mint",
  "bg-choice-amber",
];

type StatsTab = "questions" | "participants";

export function StatsView({ quizList }: Props) {
  const finished = quizList.filter((q) => q.status === QuizStatus.Finished);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [stats, setStats] = useState<QuizStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatsTab>("questions");

  useEffect(() => {
    if (!selectedQuizId) {
      setStats(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    getQuizStats(selectedQuizId)
      .then(setStats)
      .catch(() => setError("統計データの取得に失敗しました"))
      .finally(() => setIsLoading(false));
  }, [selectedQuizId]);

  if (finished.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
        <p className="text-lg font-semibold mb-2">統計データがありません</p>
        <p className="text-sm">ゲームを完了すると、ここに統計が表示されます。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* クイズ選択 */}
      <section className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-3 text-gray-800">統計を表示するゲームを選択</h2>
        <div className="flex flex-col gap-2">
          {finished.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedQuizId(q.id)}
              className={cn(
                "px-4 py-3 rounded-lg text-left transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
                selectedQuizId === q.id
                  ? "bg-accent/10 border-2 border-accent"
                  : "bg-gray-50 border-2 border-transparent hover:bg-gray-100",
              )}
            >
              <div className="font-semibold text-gray-800">{q.title}</div>
              <div className="text-sm text-gray-500 mt-0.5">
                {q.question_count}問 ・ {q.participant_count}人参加
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 読み込み中/エラー */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500 text-sm">統計データを読み込み中…</div>
      )}
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* 統計表示 */}
      {stats && !isLoading && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* タブ */}
          <div className="flex border-b border-gray-200" role="tablist">
            {([
              { key: "questions" as const, label: "問題別統計" },
              { key: "participants" as const, label: "参加者別統計" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex-1 py-3 text-sm font-semibold transition-colors duration-150 cursor-pointer",
                  btnFocus,
                  activeTab === key
                    ? "text-accent border-b-2 border-accent bg-accent/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "questions" && (
              <QuestionStatsTab stats={stats} />
            )}
            {activeTab === "participants" && (
              <ParticipantStatsTab stats={stats} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// 問題別統計タブ
function QuestionStatsTab({ stats }: { stats: QuizStatsData }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 gap-y-1 items-center text-sm text-gray-500 font-medium px-2">
        <span>#</span>
        <span>問題</span>
        <span>正答率</span>
        <span>難易度</span>
        <span>平均時間</span>
      </div>
      {stats.questionStats.map((q) => (
        <QuestionStatsRow
          key={q.questionId}
          q={q}
          totalParticipants={stats.totalParticipants}
          isExpanded={expandedId === q.questionId}
          onToggle={() => setExpandedId(expandedId === q.questionId ? null : q.questionId)}
        />
      ))}
    </div>
  );
}

function QuestionStatsRow({ q, totalParticipants, isExpanded, onToggle }: {
  q: QuestionStats;
  totalParticipants: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 text-left transition-colors duration-150 cursor-pointer hover:bg-gray-50",
          btnFocus,
        )}
      >
        <span className="text-sm font-bold text-gray-400 w-8">Q{q.orderIndex + 1}</span>
        <span className="text-sm text-gray-800 truncate">
          {q.text}
          {q.pointMultiplier > 1 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              {q.pointMultiplier}倍
            </span>
          )}
        </span>
        <span className="text-sm font-bold text-gray-800 w-14 text-right">{q.correctRate}%</span>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold w-12 text-center", DIFFICULTY_CLASSES[q.difficulty])}>
          {DIFFICULTY_LABELS[q.difficulty]}
        </span>
        <span className="text-sm text-gray-500 w-16 text-right">{(q.averageResponseTimeMs / 1000).toFixed(1)}秒</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
          <div className="pt-3">
            <p className="text-xs text-gray-500 mb-2">
              回答: {q.totalAnswers}/{totalParticipants}人（無回答: {q.noAnswerCount}人）
            </p>
            <div className="flex flex-col gap-1.5">
              {q.distribution.map((count, i) => {
                const isCorrect = i + 1 === q.correctChoice;
                const pct = q.totalAnswers > 0 ? Math.round((count / q.totalAnswers) * 100) : 0;
                const label = q.questionType === "true_false"
                  ? (i === 0 ? "○" : "×")
                  : `${String.fromCharCode(65 + i)}`;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={cn("w-6 font-bold text-center", isCorrect ? "text-green-600" : "text-gray-500")}>
                      {label}
                    </span>
                    <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", isCorrect ? "bg-green-400" : RATE_BAR_CLASSES[i])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs text-gray-500">
                      {count}人 ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 参加者別統計タブ
function ParticipantStatsTab({ stats }: { stats: QuizStatsData }) {
  const [showChart, setShowChart] = useState(false);

  // ハイライト計算
  const topScorer = stats.participantStats[0];
  const fastestAvg = stats.participantStats.length > 0
    ? stats.participantStats.reduce((best, p) =>
        p.averageResponseTimeMs > 0 && (best.averageResponseTimeMs === 0 || p.averageResponseTimeMs < best.averageResponseTimeMs)
          ? p : best
      )
    : null;
  const highestAccuracy = stats.participantStats.length > 0
    ? stats.participantStats.reduce((best, p) => p.correctRate > best.correctRate ? p : best)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ハイライト */}
      {stats.participantStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {topScorer && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-xs text-amber-600 font-semibold">最高スコア</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{topScorer.nickname}</div>
              <div className="text-xs text-gray-500">{topScorer.totalScore}点</div>
            </div>
          )}
          {highestAccuracy && (
            <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200">
              <div className="text-xs text-green-600 font-semibold">最高正答率</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{highestAccuracy.nickname}</div>
              <div className="text-xs text-gray-500">{highestAccuracy.correctRate}%</div>
            </div>
          )}
          {fastestAvg && fastestAvg.averageResponseTimeMs > 0 && (
            <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-600 font-semibold">最速平均回答</div>
              <div className="text-sm font-bold text-gray-800 mt-0.5">{fastestAvg.nickname}</div>
              <div className="text-xs text-gray-500">{(fastestAvg.averageResponseTimeMs / 1000).toFixed(1)}秒</div>
            </div>
          )}
        </div>
      )}

      {/* スコア推移チャート切り替え */}
      {stats.totalQuestions > 1 && stats.participantStats.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowChart(!showChart)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs border transition-colors duration-150 cursor-pointer",
              btnFocus,
              showChart
                ? "bg-accent text-white border-accent"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
            )}
          >
            {showChart ? "テーブル表示" : "スコア推移グラフ"}
          </button>
        </div>
      )}

      {showChart ? (
        <ScoreProgressChart stats={stats} />
      ) : (
        <ParticipantTable stats={stats} />
      )}
    </div>
  );
}

function ParticipantTable({ stats }: { stats: QuizStatsData }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-2 font-medium w-10">#</th>
            <th className="py-2 pr-2 font-medium">ニックネーム</th>
            {stats.teamMode && <th className="py-2 pr-2 font-medium">チーム</th>}
            <th className="py-2 pr-2 font-medium text-right">スコア</th>
            <th className="py-2 pr-2 font-medium text-right">正答率</th>
            <th className="py-2 pr-2 font-medium text-right">平均回答</th>
            <th className="py-2 font-medium text-right">最速回答</th>
          </tr>
        </thead>
        <tbody>
          {stats.participantStats.map((p) => (
            <tr key={p.participantId} className="border-b border-gray-100 last:border-0">
              <td className="py-2.5 pr-2 font-bold text-gray-400">{p.rank}</td>
              <td className="py-2.5 pr-2 font-semibold text-gray-800">{p.nickname}</td>
              {stats.teamMode && <td className="py-2.5 pr-2 text-gray-500">{p.teamName ?? "—"}</td>}
              <td className="py-2.5 pr-2 text-right font-bold text-gray-800">{p.totalScore}</td>
              <td className="py-2.5 pr-2 text-right text-gray-600">{p.correctRate}%</td>
              <td className="py-2.5 pr-2 text-right text-gray-500">
                {p.averageResponseTimeMs > 0 ? `${(p.averageResponseTimeMs / 1000).toFixed(1)}秒` : "—"}
              </td>
              <td className="py-2.5 text-right text-gray-500">
                {p.fastestResponseTimeMs > 0 ? `${(p.fastestResponseTimeMs / 1000).toFixed(1)}秒` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// SVGベースのスコア推移チャート（上位5名）
function ScoreProgressChart({ stats }: { stats: QuizStatsData }) {
  const top5 = stats.participantStats.slice(0, 5);
  if (top5.length === 0 || stats.totalQuestions === 0) return null;

  const maxScore = Math.max(...top5.map((p) => p.scoreProgress[p.scoreProgress.length - 1] ?? 0), 1);
  const chartW = 600;
  const chartH = 300;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const lineColors = ["#f43f5e", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

  function x(qi: number) {
    return padL + (qi / (stats.totalQuestions - 1 || 1)) * plotW;
  }
  function y(score: number) {
    return padT + plotH - (score / maxScore) * plotH;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-[600px] mx-auto" role="img" aria-label="スコア推移グラフ">
          {/* Y軸目盛り */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = Math.round(maxScore * ratio);
            const yPos = y(val);
            return (
              <g key={ratio}>
                <line x1={padL} y1={yPos} x2={chartW - padR} y2={yPos} stroke="#e5e7eb" strokeWidth={1} />
                <text x={padL - 8} y={yPos + 4} textAnchor="end" className="text-[10px] fill-gray-400">{val}</text>
              </g>
            );
          })}
          {/* X軸ラベル */}
          {Array.from({ length: stats.totalQuestions }, (_, i) => (
            <text key={i} x={x(i)} y={chartH - 6} textAnchor="middle" className="text-[10px] fill-gray-400">Q{i + 1}</text>
          ))}
          {/* 折れ線 */}
          {top5.map((p, pi) => {
            const points = p.scoreProgress.map((s, qi) => `${x(qi)},${y(s)}`).join(" ");
            return (
              <polyline
                key={p.participantId}
                points={points}
                fill="none"
                stroke={lineColors[pi]}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
      </div>
      {/* 凡例 */}
      <div className="flex flex-wrap justify-center gap-3">
        {top5.map((p, pi) => (
          <div key={p.participantId} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: lineColors[pi] }} />
            {p.nickname}
          </div>
        ))}
      </div>
    </div>
  );
}
