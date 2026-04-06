import { useState, useCallback } from "react";
import type { QuestionData } from "../../types";
import { ChoiceButton } from "../../components/quiz/ChoiceButton";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  hasAnswered: boolean;
  onAnswer: (choiceIndex: number) => void;
  answerCount?: number;
};

const CHOICE_COLORS = ["red", "blue", "green", "yellow"] as const;
const TF_STYLES = [
  "bg-green-500 hover:bg-green-600 active:bg-green-700",
  "bg-rose-500 hover:bg-rose-600 active:bg-rose-700",
] as const;

export function AnswerPage({ question, timeRemaining: rawTimeRemaining, hasAnswered, onAnswer, answerCount }: Props) {
  const timeRemaining = Math.max(0, rawTimeRemaining);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  // hasAnsweredがfalseに戻ったらレンダー中にリセット（送信失敗時の再選択対応）
  // React推奨: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevHasAnswered, setPrevHasAnswered] = useState(hasAnswered);
  if (prevHasAnswered !== hasAnswered) {
    setPrevHasAnswered(hasAnswered);
    if (!hasAnswered) {
      setSelectedChoice(null);
    }
  }

  const handleChoiceClick = useCallback((choiceIndex: number) => {
    setSelectedChoice((prev) => {
      if (prev !== null) return prev;
      onAnswer(choiceIndex);
      return choiceIndex;
    });
  }, [onAnswer]);

  if (!question) return null;

  const safeMediaUrl = sanitizeMediaUrl(question.mediaUrl);

  if (hasAnswered) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical text-gray-900" role="status" aria-live="polite">
        <div className="glass-card rounded-3xl p-10 flex flex-col items-center animate-fade-up">
          <div className="mb-4 text-primary" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-sage-text">回答済み</p>
          <p className="text-sm text-sage-text/60 mt-2">結果をお待ちください…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-blush via-white/50 to-blush">
      {/* ボーナスバナー */}
      {question.pointMultiplier > 1 && (
        <div className="bg-gradient-to-r from-amber-400/90 to-amber-300/90 backdrop-blur-sm text-amber-900 text-center py-2.5 text-sm font-bold tracking-wide shadow-sm">
          ボーナス問題！ ポイント{question.pointMultiplier}倍！
        </div>
      )}

      {/* ヘッダー: 問題番号 + 回答数 + タイマー */}
      <header className="flex justify-between items-center px-4 py-3 text-sage-text">
        <div className="flex flex-col">
          <span className="text-sm font-serif-wedding tracking-wider text-sage-text/70">
            Q{question.questionIndex + 1} / {question.totalQuestions}
          </span>
          {answerCount !== undefined && answerCount > 0 && (
            <span className="text-xs text-sage-text/50">回答済み: {answerCount}人</span>
          )}
        </div>
        <div
          className={`text-4xl font-bold [font-variant-numeric:tabular-nums] ${timeRemaining <= 5 ? "text-red-500 motion-safe:animate-scale-pulse" : "text-sage-text"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">残り</span>
          {timeRemaining}
          <span className="sr-only">秒</span>
        </div>
      </header>

      {/* 問題文 */}
      <div className="px-4 py-2 text-sage-text text-center">
        {safeMediaUrl && question.mediaType === "image" ? (
          <img
            src={safeMediaUrl}
            alt={question.mediaAltText || "問題の画像"}
            width={480}
            height={320}
            loading="lazy"
            className="max-w-[80%] max-h-[25vh] rounded-xl mb-3 object-cover mx-auto shadow-lg"
          />
        ) : null}
        <p className="text-xl font-bold leading-relaxed">{question.text}</p>
      </div>

      {/* 回答ボタン */}
      {question.questionType === "true_false" ? (
        <div className="flex-1 grid grid-cols-2 gap-3 p-3" role="group" aria-label="回答選択肢">
          {question.choices.map((choice, i) => {
            const choiceIndex = i + 1;
            const isSelected = selectedChoice === choiceIndex;
            return (
              <button
                key={`${question.questionIndex}-${i}`}
                type="button"
                disabled={selectedChoice !== null}
                onClick={() => handleChoiceClick(choiceIndex)}
                aria-label={`${choice}`}
                aria-pressed={isSelected}
                className={`flex items-center justify-center rounded-2xl text-white font-bold motion-safe:transition-all motion-safe:duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${TF_STYLES[i]} ${isSelected ? "ring-4 ring-white scale-95" : ""} ${selectedChoice !== null && !isSelected ? "opacity-50" : ""} ${selectedChoice !== null ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className="text-7xl">{choice}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-2 p-2" role="group" aria-label="回答選択肢">
          {question.choices.map((choice, i) => {
            const choiceIndex = i + 1;
            const isSelected = selectedChoice === choiceIndex;

            return (
              <ChoiceButton
                key={`${question.questionIndex}-${i}`}
                choice={choice}
                color={CHOICE_COLORS[i]}
                isSelected={isSelected}
                disabled={selectedChoice !== null}
                choiceIndex={choiceIndex}
                choiceImageUrl={question.choiceImageUrls?.[i]}
                onClick={handleChoiceClick}
                aria-label={`選択肢${choiceIndex}: ${choice || `画像${choiceIndex}`}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
