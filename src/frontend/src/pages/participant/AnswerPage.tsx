import { useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import type { QuestionData } from "../../types";
import { ChoiceButton } from "../../components/quiz/ChoiceButton";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  hasAnswered: boolean;
  onAnswer: (choiceIndex: number) => void;
};

const CHOICE_COLORS = ["red", "blue", "green", "yellow"] as const;
const CHOICE_ICONS = ["▲", "◆", "●", "■"];

export function AnswerPage({ question, timeRemaining: rawTimeRemaining, hasAnswered, onAnswer }: Props) {
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
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white">
        <div className="mb-4 text-green-400" aria-label="回答完了">
          <CheckCircle2 size={64} strokeWidth={1.5} />
        </div>
        <p className="text-2xl font-bold">回答済み</p>
        <p className="text-base text-gray-400 mt-2">結果をお待ちください...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-dark">
      {/* ヘッダー: 問題番号 + タイマー */}
      <header className="flex justify-between items-center px-4 py-3 text-white">
        <span className="text-sm">
          Q{question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <div
          className={`text-4xl font-bold ${timeRemaining <= 5 ? "text-[#ef5350]" : "text-white"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">残り</span>
          {timeRemaining}
          <span className="sr-only">秒</span>
        </div>
      </header>

      {/* 問題文 */}
      <div className="px-4 py-2 text-white text-center">
        {question.mediaUrl !== null && question.mediaType === "image" ? (
          <img
            src={question.mediaUrl}
            alt={question.mediaAltText || "問題の画像"}
            width={600}
            height={400}
            loading="lazy"
            className="max-w-[80%] max-h-[25vh] rounded-lg mb-2 object-contain mx-auto"
          />
        ) : null}
        <p className="text-lg font-bold">{question.text}</p>
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
              icon={CHOICE_ICONS[i]}
              isSelected={isSelected}
              disabled={selectedChoice !== null}
              choiceIndex={choiceIndex}
              onClick={handleChoiceClick}
              aria-label={`選択肢${choiceIndex}: ${choice}`}
            />
          );
        })}
      </div>
    </div>
  );
}
