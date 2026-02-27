import { useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
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

  if (hasAnswered) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-blush text-gray-900" role="status" aria-live="polite">
        <div className="mb-4 text-green-600" aria-hidden="true">
          <CheckCircle2 size={64} strokeWidth={1.5} />
        </div>
        <p className="text-2xl font-bold">回答済み</p>
        <p className="text-base text-gray-600 mt-2">結果をお待ちください…</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-blush">
      {/* ヘッダー: 問題番号 + 回答数 + タイマー */}
      <header className="flex justify-between items-center px-4 py-3 text-gray-900">
        <div className="flex flex-col">
          <span className="text-sm">
            Q{question.questionIndex + 1} / {question.totalQuestions}
          </span>
          {answerCount !== undefined && answerCount > 0 && (
            <span className="text-xs text-gray-500">回答済み: {answerCount}人</span>
          )}
        </div>
        <div
          className={`text-4xl font-bold ${timeRemaining <= 5 ? "text-red-600" : "text-gray-900"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">残り</span>
          {timeRemaining}
          <span className="sr-only">秒</span>
        </div>
      </header>

      {/* 問題文 */}
      <div className="px-4 py-2 text-gray-900 text-center">
        {sanitizeMediaUrl(question.mediaUrl) && question.mediaType === "image" ? (
          <img
            src={sanitizeMediaUrl(question.mediaUrl)!}
            alt={question.mediaAltText || "問題の画像"}
            width={600}
            height={400}
            loading="lazy"
            className="max-w-[80%] max-h-[25vh] rounded-lg mb-2 object-cover mx-auto"
          />
        ) : null}
        <p className="text-xl font-bold">{question.text}</p>
      </div>

      {/* 4色回答ボタン */}
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
    </div>
  );
}
