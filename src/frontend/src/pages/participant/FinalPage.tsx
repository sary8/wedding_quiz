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

  return (
    <div
      className={[
        "h-[100dvh] flex flex-col items-center justify-center text-white p-6",
        isTopThree
          ? "bg-gradient-to-br from-[#ffd700] to-[#ff8c00]"
          : "bg-gradient-to-br from-primary to-primary-dark",
      ].join(" ")}
    >
      <h2 className="text-2xl font-normal mb-2">あなたの最終順位</h2>
      <p className="text-8xl font-bold mb-6">第{myResult.rank}位</p>

      <div className="bg-black/20 rounded-2xl p-6 text-center min-w-[280px]">
        <p className="text-base mb-2">ニックネーム: {myResult.nickname}</p>
        <p className="text-3xl font-bold mb-4">{myResult.totalScore.toLocaleString()}点</p>
        <div className="flex flex-col gap-2 text-sm">
          <p>正答率: {accuracyPercent}% ({myResult.correctCount}/{myResult.totalQuestions}問)</p>
          <p>平均回答速度: {(myResult.averageResponseTimeMs / 1000).toFixed(2)}秒</p>
          <p>最速回答: {(myResult.fastestResponseTimeMs / 1000).toFixed(2)}秒</p>
        </div>
      </div>

      <p className="text-sm mt-8 opacity-70">ご参加ありがとうございました！</p>
    </div>
  );
}
