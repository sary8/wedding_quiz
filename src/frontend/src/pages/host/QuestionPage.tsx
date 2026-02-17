import type { QuestionData } from "../../types";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  answerCount: number;
  totalParticipants: number;
  onCloseQuestion: () => void;
};

const CHOICE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];
const CHOICE_ICONS = ["▲", "◆", "●", "■"];

export function QuestionPage({ question, timeRemaining, answerCount, totalParticipants, onCloseQuestion }: Props) {
  if (!question) return null;

  const isUrgent = timeRemaining <= 5;

  return (
    <div className="h-[100dvh] flex flex-col bg-dark">
      {/* ヘッダー */}
      <div className="flex justify-between items-center px-6 py-4 text-white">
        <span className="text-base">
          Q{question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <span
          className="text-5xl font-bold transition-colors duration-300"
          style={{ color: isUrgent ? "#ef5350" : "#fff" }}
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
            className="max-w-[60%] max-h-[40vh] rounded-xl mb-6 object-contain"
          />
        ) : null}
        {question.mediaUrl !== null && question.mediaType === "video" ? (
          <video
            src={question.mediaUrl}
            autoPlay
            muted
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
            className="flex items-center gap-3 px-6 py-5 rounded-xl text-white text-2xl font-bold"
            style={{ background: CHOICE_COLORS[i] }}
          >
            <span aria-hidden="true" className="text-3xl">{CHOICE_ICONS[i]}</span>
            {choice}
          </div>
        ))}
      </div>

      {/* 手動締め切りボタン */}
      <div className="px-6 pb-6 text-center">
        <button
          onClick={onCloseQuestion}
          className="px-6 py-3 rounded-lg bg-white/20 text-white text-sm min-h-[44px] hover:bg-white/30 transition-colors duration-200"
        >
          回答を締め切る
        </button>
      </div>
    </div>
  );
}
