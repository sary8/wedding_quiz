import type { FinalResultData } from "../../types";

type Props = {
  data: FinalResultData | null;
  participantId: number | null;
};

export function ParticipantFinalPage({ data, participantId }: Props) {
  if (!data || !participantId) return null;

  const myResult = data.rankings.find((r) => r.participantId === participantId);
  if (!myResult) return null;

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

      {/* タイトル */}
      <h2 className="font-script text-4xl text-primary mb-1">最終結果</h2>
      <div className="flex items-center gap-3 mb-6 w-40">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
        <span className="text-accent/60 text-xs" aria-hidden="true">◆</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
      </div>

      {/* 順位 */}
      <p className={[
        "text-7xl font-bold mb-6",
        isTopThree ? "text-[#92400E]" : "text-rose-text",
      ].join(" ")}>
        {rankLabel}
      </p>

      {/* スコアカード */}
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-[0_4px_24px_rgba(219,39,119,0.12)] border border-primary/10 p-6 text-center">
        <p className="text-sm text-rose-text/60 mb-1">{myResult.nickname}</p>
        <p className="text-3xl font-bold text-rose-text mb-4">
          {myResult.totalScore.toLocaleString()}<span className="text-base">点</span>
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/30" />
          <span className="text-accent/60 text-xs" aria-hidden="true">◆</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/30" />
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-rose-text/70">
          <p>正答率: {accuracyPercent}% ({myResult.correctCount}/{myResult.totalQuestions}問)</p>
          <p>平均回答速度: {(myResult.averageResponseTimeMs / 1000).toFixed(2)}秒</p>
          <p>最速回答: {(myResult.fastestResponseTimeMs / 1000).toFixed(2)}秒</p>
        </div>
      </div>

      <p className="text-sm mt-8 text-rose-text/40">ご参加ありがとうございました！</p>
    </div>
  );
}
