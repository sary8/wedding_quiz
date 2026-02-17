import type { QuestionData } from "../../types";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  answerCount: number;
  totalParticipants: number;
  onCloseQuestion: () => void;
  isDisplay?: boolean;
};

const CHOICE_BG_CLASSES = ["bg-choice-red", "bg-choice-blue", "bg-choice-green", "bg-choice-yellow"];
const CHOICE_ICONS = ["▲", "◆", "●", "■"];

export function QuestionPage({ question, timeRemaining: rawTimeRemaining, answerCount, totalParticipants, onCloseQuestion, isDisplay = false }: Props) {
  if (!question) return null;

  const timeRemaining = Math.max(0, rawTimeRemaining);
  const isUrgent = timeRemaining <= 5;

  return (
    <div className="h-[100dvh] flex flex-col bg-dark">
      {/* ヘッダー */}
      <div className="flex justify-between items-center px-6 py-4 text-white">
        <span className="text-base">
          Q{question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <span
          className={`text-5xl font-bold transition-colors duration-300 ${isUrgent ? "text-[#ef5350]" : "text-white"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">残り</span>
          {timeRemaining}
          <span className="sr-only">秒</span>
        </span>
        <span className="text-base">
          回答: {answerCount} / {totalParticipants}
        </span>
      </div>

      {/* 問題文 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {question.mediaUrl !== null && question.mediaType === "image" ? (
          <img
            src={question.mediaUrl}
            alt={question.mediaAltText || "問題の画像"}
            width={600}
            height={400}
            loading="lazy"
            className="max-w-[60%] max-h-[40vh] rounded-xl mb-6 object-contain"
          />
        ) : null}
        {question.mediaUrl !== null && question.mediaType === "video" ? (
          <video
            src={question.mediaUrl}
            autoPlay
            muted
            aria-label="問題の動画"
            className="max-w-[60%] max-h-[40vh] rounded-xl mb-6"
          />
        ) : null}
        <h2 className="text-4xl text-white text-center">{question.text}</h2>
      </div>

      {/* 選択肢 */}
      <div className="grid grid-cols-2 gap-2 px-6 pb-4">
        {question.choices.map((choice, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-6 py-5 rounded-xl text-white text-2xl font-bold ${CHOICE_BG_CLASSES[i]}`}
          >
            <span aria-hidden="true" className="text-3xl">{CHOICE_ICONS[i]}</span>
            {choice}
          </div>
        ))}
      </div>

      {/* 手動締め切りボタン */}
      {!isDisplay && (
        <div className="px-6 pb-6 text-center">
          <button
            type="button"
            onClick={onCloseQuestion}
            className="px-6 py-3 rounded-lg bg-white/20 text-white text-sm min-h-[44px] hover:bg-white/30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            回答を締め切る
          </button>
        </div>
      )}
    </div>
  );
}
