import { useMemo, useState } from "react";
import type { FinalResultData } from "../../types";

type Props = {
  data: FinalResultData | null;
  participantId: number | null;
  resultsRevealed: boolean;
  onDeleteMyData?: () => void;
  dataDeleted?: boolean;
};

export function ParticipantFinalPage({ data, participantId, resultsRevealed, onDeleteMyData, dataDeleted }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const myResult = useMemo(
    () => (data && participantId) ? data.rankings.find((r) => r.participantId === participantId) : null,
    [data, participantId],
  );

  if (!data || !participantId || !myResult) return null;

  if (!resultsRevealed) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white p-6">
        <h2 className="font-script text-4xl text-primary mb-4 [text-wrap:balance]">最終結果発表中...</h2>
        <div className="flex items-center gap-3 mb-8 w-40">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
          <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent/60" aria-hidden="true" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
        </div>
        <p className="text-lg text-sage-text/70 text-center">スクリーンをご覧ください</p>
      </div>
    );
  }

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

      {/* 自己データ削除（プライバシーポリシー記載の機能） */}
      {onDeleteMyData && (
        <div className="mt-4 text-center">
          {dataDeleted ? (
            <p className="text-xs text-sage-text/60" role="status">
              あなたのデータ（ニックネーム・自撮り・回答）を削除しました
            </p>
          ) : confirmingDelete ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-sage-text/70">
                ニックネーム・自撮り・回答データを今すぐ削除します。よろしいですか？
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onDeleteMyData}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors duration-200 min-h-[44px]"
                >
                  削除する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-sage-text/20 text-sage-text text-xs hover:bg-sage-text/5 transition-colors duration-200 min-h-[44px]"
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-sage-text/50 underline hover:text-sage-text/80 transition-colors duration-200 min-h-[44px]"
            >
              自分のデータを今すぐ削除する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
