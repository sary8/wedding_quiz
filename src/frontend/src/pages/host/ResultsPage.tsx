import { useMemo } from "react";
import type { QuestionResultData, QuestionData } from "../../types";
import { cn } from "../../utils/cn";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

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
const CHOICE_BAR_TRACK_CLASSES = [
  "bg-choice-pastel-rose/25",
  "bg-choice-pastel-sky/25",
  "bg-choice-pastel-mint/25",
  "bg-choice-pastel-amber/25",
];

const TF_BAR_CLASSES = ["bg-green-500", "bg-rose-500"];
const TF_BAR_DIM_CLASSES = ["bg-green-500/50", "bg-rose-500/50"];
const TF_BAR_TRACK_CLASSES = ["bg-green-500/25", "bg-rose-500/25"];

export function ResultsPage({ result, question, onShowRanking, onNextQuestion, isDisplay = false }: Props) {
  const { totalAnswers, maxCount } = useMemo(() => {
    if (!result?.distribution) return { totalAnswers: 0, maxCount: 1 };
    let total = 0;
    let max = 1;
    for (const n of result.distribution) {
      total += n;
      if (n > max) max = n;
    }
    return { totalAnswers: total, maxCount: max };
  }, [result?.distribution]);

  if (!result) {
    return (
      <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
      <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col items-center justify-center text-gray-900 gap-6">
        <p className="text-2xl text-gray-700">結果データを取得中…</p>
        {!isDisplay && (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onShowRanking}
              className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-lg font-bold min-h-[44px] hover:bg-amber-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              ランキング表示
            </button>
            <button
              type="button"
              onClick={onNextQuestion}
              className="px-8 py-4 rounded-xl bg-pink-200/80 text-pink-900 text-lg font-bold min-h-[44px] hover:bg-pink-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
            >
              次の問題
            </button>
          </div>
        )}
      </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col items-center justify-center text-gray-900 p-8">
      <h2 className="font-script text-6xl lg:text-8xl text-amber-800 mb-8 [text-wrap:balance]">Results</h2>

      {/* 回答分布グラフ */}
      <div className="w-full max-w-5xl mb-12">
        {result.distribution.map((count, i) => {
          const isCorrect = i + 1 === result.correctChoice;
          const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
          const barWidth = (count / maxCount) * 100;
          const choiceText = question?.choices[i] || `選択肢${i + 1}`;
          const isTF = question?.questionType === "true_false";
          const barClass = isTF
            ? (isCorrect ? TF_BAR_CLASSES[i] : TF_BAR_DIM_CLASSES[i])
            : (isCorrect ? CHOICE_BAR_CLASSES[i] : CHOICE_BAR_DIM_CLASSES[i]);
          const trackClass = isTF ? TF_BAR_TRACK_CLASSES[i] : CHOICE_BAR_TRACK_CLASSES[i];
          const safeChoiceImageUrl = sanitizeMediaUrl(question?.choiceImageUrls?.[i]);

          return (
            <div key={i} className="mb-5">
              <div className="flex justify-between mb-1.5">
                <span className={cn("flex items-center gap-3", isCorrect ? "font-bold text-2xl lg:text-4xl" : "font-normal text-2xl lg:text-4xl")}>
                  {safeChoiceImageUrl && (
                    <div className="w-14 h-14 lg:w-20 lg:h-20 shrink-0 overflow-hidden rounded">
                      <img
                        src={safeChoiceImageUrl}
                        alt={choiceText}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {isTF ? <span className="text-4xl lg:text-6xl">{choiceText}</span> : choiceText}
                  {isCorrect && (
                    <>
                      <svg className="inline w-6 h-6 lg:w-8 lg:h-8 ml-1" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                      <span> 正解</span>
                    </>
                  )}
                </span>
                <span className="text-2xl lg:text-4xl [font-variant-numeric:tabular-nums]">{count}人 ({percentage}%)</span>
              </div>
              <div className={`h-14 lg:h-16 ${trackClass} rounded-lg overflow-hidden`}>
                <div
                  className={`h-full rounded-lg motion-safe:transition-[width] motion-safe:duration-700 ease-out ${barClass}`}
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
            className="px-8 py-4 rounded-xl bg-amber-200/80 text-amber-900 text-xl font-bold hover:bg-amber-200 transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            ランキング表示
          </button>
          <button
            type="button"
            onClick={onNextQuestion}
            className="px-8 py-4 rounded-xl bg-pink-200/80 text-pink-900 text-xl font-bold hover:bg-pink-200 transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          >
            次の問題
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
