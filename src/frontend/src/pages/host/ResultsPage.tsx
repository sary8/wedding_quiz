import { useMemo } from "react";
import type { QuestionResultData, QuestionData } from "../../types";

type Props = {
  result: QuestionResultData | null;
  question: QuestionData | null;
  onShowRanking: () => void;
  onNextQuestion: () => void;
};

const CHOICE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];

export function ResultsPage({ result, question, onShowRanking, onNextQuestion }: Props) {
  const { totalAnswers, maxCount } = useMemo(() => ({
    totalAnswers: result?.distribution.reduce((s, n) => s + n, 0) ?? 0,
    maxCount: result?.distribution.reduce((max, n) => Math.max(max, n), 1) ?? 1,
  }), [result?.distribution]);

  if (!result) return null;

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white p-6">
      <h2 className="font-script text-4xl text-accent mb-8">Results</h2>

      {/* 回答分布グラフ */}
      <div className="w-full max-w-xl mb-12">
        {result.distribution.map((count, i) => {
          const isCorrect = i + 1 === result.correctChoice;
          const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
          const barWidth = (count / maxCount) * 100;
          const choiceText = question?.choices[i] || `選択肢${i + 1}`;
          const barColor = isCorrect ? CHOICE_COLORS[i] : `${CHOICE_COLORS[i]}88`;

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
              <div className="h-10 bg-white/10 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-[width] duration-700 ease-out"
                  style={{ width: `${barWidth}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onShowRanking}
          className="px-8 py-4 rounded-xl bg-accent text-dark text-lg font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px]"
        >
          ランキング表示
        </button>
        <button
          type="button"
          onClick={onNextQuestion}
          className="px-8 py-4 rounded-xl bg-white/20 text-white text-lg font-bold hover:bg-white/30 transition-colors duration-200 min-h-[44px]"
        >
          次の問題
        </button>
      </div>
    </div>
  );
}
