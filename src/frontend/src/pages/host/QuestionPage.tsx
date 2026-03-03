import type { QuestionData } from "../../types";
import { cn } from "../../utils/cn";
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

const TF_HOST_CLASSES = [
  "bg-green-400 text-white",
  "bg-rose-400 text-white",
];

export function QuestionPage({ question, timeRemaining: rawTimeRemaining, answerCount, totalParticipants, onCloseQuestion, isDisplay = false }: Props) {
  if (!question) return null;

  const timeRemaining = Math.max(0, rawTimeRemaining);
  const isUrgent = timeRemaining <= 5;
  const hasChoiceImages = question.choiceImageUrls?.some(Boolean);
  const safeMediaUrl = sanitizeMediaUrl(question.mediaUrl);

  return (
    <div className={cn("h-[100dvh] bg-gradient-to-b from-blush to-white", isDisplay && "overflow-hidden")}>
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col">
      {/* ヘッダー */}
      <div className={cn("flex justify-between items-center px-8 text-gray-900 shrink-0", isDisplay ? "py-2" : "py-4")}>
        <div className="flex items-center gap-3">
          <span className="text-2xl lg:text-4xl font-semibold">
            Q{question.questionIndex + 1} / {question.totalQuestions}
          </span>
          {question.pointMultiplier > 1 && (
            <span className="px-3 py-1 rounded-full bg-amber-400 text-amber-900 text-lg lg:text-2xl font-bold motion-safe:animate-pulse">
              {question.pointMultiplier}x
            </span>
          )}
        </div>
        <span
          className={cn("font-bold transition-colors duration-300", isDisplay ? "text-6xl" : "text-7xl lg:text-9xl", isUrgent ? "text-red-600 motion-safe:animate-scale-pulse" : "text-gray-900")}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">残り</span>
          {timeRemaining}
          <span className="sr-only">秒</span>
        </span>
        <span className="text-2xl lg:text-4xl font-semibold">
          Answers: {answerCount} / {totalParticipants}
        </span>
      </div>

      {/* 問題文 */}
      <div className={cn("flex flex-col items-center justify-center px-8 min-h-0", isDisplay ? "flex-[2] overflow-hidden" : "flex-1")}>
        {safeMediaUrl && question.mediaType === "image" ? (
          <div className={cn("max-w-[55%] mb-4 overflow-hidden rounded-xl", isDisplay ? "max-h-[50%]" : "max-h-[35vh]")}>
            <img
              src={safeMediaUrl}
              alt={question.mediaAltText || "問題の画像"}
              width={600}
              height={400}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
        {safeMediaUrl && question.mediaType === "video" ? (
          <video
            src={safeMediaUrl}
            autoPlay
            muted
            aria-label="問題の動画"
            className={cn("max-w-[55%] rounded-xl mb-4", isDisplay ? "max-h-[50%]" : "max-h-[35vh]")}
          />
        ) : null}
        <h2 className={cn("text-gray-900 text-center [text-wrap:balance] leading-tight", isDisplay ? "text-5xl line-clamp-2" : "text-6xl lg:text-8xl line-clamp-3")}>{question.text}</h2>
      </div>

      {/* 選択肢 */}
      {question.questionType === "true_false" ? (
        <div className={cn("grid grid-cols-2 gap-6 px-8 pb-4", isDisplay && "flex-[3] min-h-0")}>
          {question.choices.map((choice, i) => (
            <div
              key={i}
              className={cn("flex items-center justify-center px-8 rounded-xl font-bold", isDisplay ? "py-4 text-7xl" : "py-10 text-8xl lg:text-[10rem]", TF_HOST_CLASSES[i])}
            >
              {choice}
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-3 px-8 pb-4", isDisplay && "flex-[3] min-h-0")}>
          {question.choices.map((choice, i) => {
            const imageUrl = sanitizeMediaUrl(question.choiceImageUrls?.[i]);
            return (
              <div
                key={i}
                className={cn("flex items-center gap-4 px-8 rounded-xl text-white font-bold", isDisplay ? "py-2" : "py-6", hasChoiceImages ? (isDisplay ? "text-2xl" : "text-3xl lg:text-4xl") : (isDisplay ? "text-3xl" : "text-4xl lg:text-6xl"), CHOICE_PASTEL_CLASSES[i])}
              >
                {imageUrl ? (
                  <div className="flex items-center gap-4 w-full h-full">
                    <div className={cn("shrink-0 overflow-hidden rounded-lg", isDisplay ? "h-[80%] w-auto aspect-square" : "w-28 h-28 lg:w-36 lg:h-36")}>
                      <img src={imageUrl} alt={choice ? `${choice}の画像` : `選択肢${i + 1}の画像`} width={144} height={144} className="w-full h-full object-cover" />
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
      )}

      {/* 手動締め切りボタン */}
      {!isDisplay && (
        <div className="px-8 pb-5 text-center">
          <button
            type="button"
            onClick={onCloseQuestion}
            className="px-8 py-3 rounded-lg bg-primary-light/80 text-primary-dark text-base font-bold min-h-[44px] hover:bg-primary-light transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            回答を締め切る
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
