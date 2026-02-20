import { useMemo } from "react";
import type { QuestionResultData, QuestionData } from "../../types";

type Props = {
  result: QuestionResultData | null;
  question: QuestionData | null;
  onShowRanking: () => void;
  onNextQuestion: () => void;
  isDisplay?: boolean;
};

const CHOICE_BAR_CLASSES = [
  "bg-choice-pastel-rose",
  "bg-choice-pastel-sky",
  "bg-choice-pastel-mint",
  "bg-choice-pastel-amber",
];
const CHOICE_BAR_DIM_CLASSES = [
  "bg-choice-pastel-rose/50",
  "bg-choice-pastel-sky/50",
  "bg-choice-pastel-mint/50",
  "bg-choice-pastel-amber/50",
];

export function ResultsPage({ result, question, onShowRanking, onNextQuestion, isDisplay = false }: Props) {
  const { totalAnswers, maxCount } = useMemo(() => ({
    totalAnswers: result?.distribution.reduce((s, n) => s + n, 0) ?? 0,
    maxCount: result?.distribution.reduce((max, n) => Math.max(max, n), 1) ?? 1,
  }), [result?.distribution]);

  if (!result) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 gap-6">
        <p className="text-xl text-gray-500">結果データを取得中…</p>
        {!isDisplay && (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onShowRanking}
              className="px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold min-h-[44px] hover:opacity-90 transition-opacity duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              ランキング表示
            </button>
            <button
              type="button"
              onClick={onNextQuestion}
              className="px-8 py-4 rounded-xl bg-primary text-white text-lg font-bold min-h-[44px] hover:brightness-110 transition-[filter] duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              次の問題
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-blush to-white text-gray-900 p-6">
      <h2 className="font-script text-4xl text-amber-800 mb-8">Results</h2>

      {/* 回答分布グラフ */}
      <div className="w-full max-w-xl mb-12">
        {result.distribution.map((count, i) => {
          const isCorrect = i + 1 === result.correctChoice;
          const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
          const barWidth = (count / maxCount) * 100;
          const choiceText = question?.choices[i] || `選択肢${i + 1}`;
          const barClass = isCorrect ? CHOICE_BAR_CLASSES[i] : CHOICE_BAR_DIM_CLASSES[i];

          return (
            <div key={i} className="mb-4">
              <div className="flex justify-between mb-1">
                <span className={isCorrect ? "font-bold text-base" : "font-normal text-base"}>
                  {choiceText}
                  {isCorrect && (
                    <>
                      <span aria-hidden="true"> ✓</span>
                      <span> 正解</span>
                    </>
                  )}
                </span>
                <span className="text-base">{count}人 ({percentage}%)</span>
              </div>
              <div className="h-10 bg-gray-900/10 rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-[width] duration-700 ease-out ${barClass}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!isDisplay && (
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onShowRanking}
            className="px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            ランキング表示
          </button>
          <button
            type="button"
            onClick={onNextQuestion}
            className="px-8 py-4 rounded-xl bg-gray-900/10 text-gray-900 text-lg font-bold hover:bg-gray-900/15 transition-colors duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            次の問題
          </button>
        </div>
      )}
    </div>
  );
}
