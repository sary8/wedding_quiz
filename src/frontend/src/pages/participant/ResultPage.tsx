import type { QuestionResultData, QuestionData } from "../../types";
import { cn } from "../../utils/cn";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

type Props = {
  result: QuestionResultData | null;
  question: QuestionData | null;
};

export function ResultPage({ result, question }: Props) {
  const correctAnswerText =
    result && question && result.correctChoice >= 1 && result.correctChoice <= question.choices.length
      ? question.choices[result.correctChoice - 1]
      : null;
  const safeCorrectImageUrl = result
    ? sanitizeMediaUrl(question?.choiceImageUrls?.[result.correctChoice - 1])
    : null;

  if (!result?.yourAnswer) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical p-6">
        <div className="glass-card rounded-3xl p-8 text-center animate-fade-up max-w-xs w-full">
          <p className="text-2xl text-sage-text font-bold">未回答</p>
          <p className="text-sm text-sage-text/60 mt-2">次の問題をお待ちください</p>

          {correctAnswerText !== null ? (
            <div className="mt-5 pt-5 border-t border-primary/10">
              <p className="text-xs text-sage-text/50 mb-1 uppercase tracking-wider font-serif-wedding">Answer</p>
              {safeCorrectImageUrl && (
                <img
                  src={safeCorrectImageUrl}
                  alt={correctAnswerText || "正解の画像"}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-cover rounded-lg mx-auto mb-2"
                />
              )}
              <p className="text-lg font-bold text-primary">{correctAnswerText}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const { yourAnswer } = result;
  const isCorrect = yourAnswer.isCorrect;

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical p-6">
      {/* 正解 / 不正解 アイコン */}
      <div
        className={cn(
          "mb-3 animate-fade-up",
          isCorrect ? "text-primary drop-shadow-[0_4px_12px_rgba(107,143,113,0.3)]" : "text-sage-text/40"
        )}
        aria-hidden="true"
      >
        {isCorrect ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m15 9-6 6M9 9l6 6"/>
          </svg>
        )}
      </div>

      <p className="font-script text-5xl text-primary mb-6 [text-wrap:balance] animate-fade-up" style={{ animationDelay: "0.1s" }} aria-live="polite">
        {isCorrect ? "正解！" : "不正解…"}
      </p>

      {/* スコアカード */}
      <div className="w-full max-w-xs glass-card-strong rounded-3xl p-6 text-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <p className="text-4xl font-bold text-sage-text mb-1 [font-variant-numeric:tabular-nums]">
          +{yourAnswer.scoreAwarded}<span className="text-base font-normal text-sage-text/60 ml-1">点</span>
        </p>

        <div className="gold-line my-4" />

        <div className="flex flex-col gap-2 text-sm text-sage-text/70 [font-variant-numeric:tabular-nums]">
          <p>回答速度: {(yourAnswer.responseTimeMs / 1000).toFixed(2)}秒</p>
          <p>累計スコア: {yourAnswer.totalScore.toLocaleString()}点</p>
          <p className="text-lg font-bold text-sage-text mt-2">
            現在 <span className="text-accent">第{yourAnswer.currentRank}位</span>
          </p>
        </div>
      </div>

      {/* 正解表示 */}
      {correctAnswerText !== null ? (
        <div className="w-full max-w-xs glass-card rounded-2xl p-5 text-center mt-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <p className="text-xs text-sage-text/50 mb-1 uppercase tracking-wider font-serif-wedding">Answer</p>
          {safeCorrectImageUrl && (
            <img
              src={safeCorrectImageUrl}
              alt={correctAnswerText || "正解の画像"}
              width={64}
              height={64}
              className="h-16 w-16 object-cover rounded-lg mx-auto mb-2"
            />
          )}
          <p className="text-lg font-bold text-primary">{correctAnswerText}</p>
        </div>
      ) : null}
    </div>
  );
}
