import type { QuestionData } from "../../types";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  answerCount: number;
  totalParticipants: number;
  onCloseQuestion: () => void;
  isDisplay?: boolean;
};

const CHOICE_PASTEL_CLASSES = [
  "bg-choice-pastel-rose text-outline-rose",
  "bg-choice-pastel-sky text-outline-sky",
  "bg-choice-pastel-mint text-outline-mint",
  "bg-choice-pastel-amber text-outline-amber",
];

export function QuestionPage({ question, timeRemaining: rawTimeRemaining, answerCount, totalParticipants, onCloseQuestion, isDisplay = false }: Props) {
  if (!question) return null;

  const timeRemaining = Math.max(0, rawTimeRemaining);
  const isUrgent = timeRemaining <= 5;
  const hasChoiceImages = question.choiceImageUrls?.some(Boolean);

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col">
      {/* ヘッダー */}
      <div className="flex justify-between items-center px-8 py-4 text-gray-900">
        <span className="text-2xl lg:text-4xl font-semibold">
          Q{question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <span
          className={`text-7xl lg:text-9xl font-bold transition-colors duration-300 ${isUrgent ? "text-red-600" : "text-gray-900"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">残り</span>
          {timeRemaining}
          <span className="sr-only">秒</span>
        </span>
        <span className="text-2xl lg:text-4xl font-semibold">
          回答: {answerCount} / {totalParticipants}
        </span>
      </div>

      {/* 問題文 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-0">
        {sanitizeMediaUrl(question.mediaUrl) && question.mediaType === "image" ? (
          <div className="max-w-[55%] max-h-[35vh] mb-4 overflow-hidden rounded-xl">
            <img
              src={sanitizeMediaUrl(question.mediaUrl)!}
              alt={question.mediaAltText || "問題の画像"}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
        {sanitizeMediaUrl(question.mediaUrl) && question.mediaType === "video" ? (
          <video
            src={sanitizeMediaUrl(question.mediaUrl)!}
            autoPlay
            muted
            aria-label="問題の動画"
            className="max-w-[55%] max-h-[35vh] rounded-xl mb-4"
          />
        ) : null}
        <h2 className="text-6xl lg:text-8xl text-gray-900 text-center [text-wrap:balance] leading-tight line-clamp-3">{question.text}</h2>
      </div>

      {/* 選択肢 */}
      <div className="grid grid-cols-2 gap-3 px-8 pb-4">
        {question.choices.map((choice, i) => {
          const imageUrl = sanitizeMediaUrl(question.choiceImageUrls?.[i]);
          return (
            <div
              key={i}
              className={`flex items-center gap-4 px-8 py-6 rounded-xl text-white font-bold ${hasChoiceImages ? "text-3xl lg:text-4xl" : "text-4xl lg:text-6xl"} ${CHOICE_PASTEL_CLASSES[i]}`}
            >
              {imageUrl ? (
                <div className="flex items-center gap-4 w-full">
                  <div className="w-28 h-28 lg:w-36 lg:h-36 shrink-0 overflow-hidden rounded-lg">
                    <img src={imageUrl} alt={choice || `選択肢${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  {choice && <span className="truncate">{choice}</span>}
                </div>
              ) : (
                choice
              )}
            </div>
          );
        })}
      </div>

      {/* 手動締め切りボタン */}
      {!isDisplay && (
        <div className="px-8 pb-5 text-center">
          <button
            type="button"
            onClick={onCloseQuestion}
            className="px-8 py-3 rounded-lg bg-pink-200/80 text-pink-900 text-base font-bold min-h-[44px] hover:bg-pink-200 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          >
            回答を締め切る
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
