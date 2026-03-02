import { useMemo } from "react";
import type { FinalResultData } from "../../types";

type Props = {
  data: FinalResultData | null;
  participantId: number | null;
};

export function ParticipantFinalPage({ data, participantId }: Props) {
  const myResult = useMemo(
    () => (data && participantId) ? data.rankings.find((r) => r.participantId === participantId) : null,
    [data, participantId],
  );

  if (!data || !participantId || !myResult) return null;

  const accuracyPercent = myResult.totalQuestions > 0
    ? Math.round((myResult.correctCount / myResult.totalQuestions) * 100)
    : 0;

  const isTopThree = myResult.rank <= 3;

  const rankLabel = `第${myResult.rank}位`;

  return (
    <div className={[
      "h-[100dvh] flex flex-col items-center justify-center p-6",
      isTopThree ? "bg-gradient-to-b from-[#FEF3C7] to-[#FDE68A]" : "bg-blush",
    ].join(" ")}>

      {/* チーム成績 */}
      {data.teamRankings && data.teamRankings.length > 0 && (
        <div className="w-full max-w-xs bg-amber-50 rounded-2xl border border-amber-200 p-4 mb-4 text-center">
          <p className="text-sm font-bold text-amber-800 mb-1">チーム成績</p>
          {data.teamRankings.map((t) => (
            <p key={t.teamId} className="text-sm text-amber-700">
              {t.teamName}: 第{t.rank}位（{t.totalScore.toLocaleString()}点）
            </p>
          ))}
        </div>
      )}

      {/* タイトル */}
      <h2 className="font-script text-4xl text-primary mb-1 [text-wrap:balance]">最終結果</h2>
      <div className="flex items-center gap-3 mb-6 w-40">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
        <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent/60" aria-hidden="true" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
      </div>

      {/* 順位 */}
      <p className={[
        "text-7xl font-bold mb-6",
        isTopThree ? "text-[#78350F]" : "text-sage-text",
      ].join(" ")}>
        {rankLabel}
      </p>

      {/* スコアカード */}
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-[0_4px_24px_rgba(107,143,113,0.12)] border border-primary/10 p-6 text-center">
        <p className="text-sm text-sage-text/70 mb-1">{myResult.nickname}</p>
        <p className="text-3xl font-bold text-sage-text mb-4 [font-variant-numeric:tabular-nums]">
          {myResult.totalScore.toLocaleString()}<span className="text-base">点</span>
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/30" />
          <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent/60" aria-hidden="true" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/30" />
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-sage-text/80 [font-variant-numeric:tabular-nums]">
          <p>正答率: {accuracyPercent}% ({myResult.correctCount}/{myResult.totalQuestions}問)</p>
          <p>平均回答速度: {(myResult.averageResponseTimeMs / 1000).toFixed(2)}秒</p>
          <p>最速回答: {(myResult.fastestResponseTimeMs / 1000).toFixed(2)}秒</p>
        </div>
      </div>

      <p className="text-sm mt-8 text-sage-text/80">ご参加ありがとうございました！</p>
    </div>
  );
}
