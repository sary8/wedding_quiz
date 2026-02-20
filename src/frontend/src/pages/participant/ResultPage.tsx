import type { QuestionResultData, QuestionData } from "../../types";
import { cn } from "../../utils/cn";

type Props = {
  result: QuestionResultData | null;
  question: QuestionData | null;
};

export function ResultPage({ result, question }: Props) {
  const correctAnswerText =
    result && question && result.correctChoice >= 1 && result.correctChoice <= question.choices.length
      ? question.choices[result.correctChoice - 1]
      : null;

  if (!result?.yourAnswer) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-blush p-6">
        <p className="text-2xl text-rose-text">未回答</p>
        <p className="text-base text-rose-text/70 mt-2">次の問題をお待ちください</p>

        {correctAnswerText !== null ? (
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-[0_4px_24px_rgba(219,39,119,0.10)] border border-primary/10 p-5 text-center mt-6">
            <p className="text-sm text-rose-text/60 mb-1">正解</p>
            <p className="text-lg font-bold text-primary">{correctAnswerText}</p>
          </div>
        ) : null}
      </div>
    );
  }

  const { yourAnswer } = result;
  const isCorrect = yourAnswer.isCorrect;

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-blush p-6">
      {/* 正解 / 不正解 アイコン */}
      <div className={cn("mb-4", isCorrect ? "text-primary" : "text-gray-500")} aria-hidden="true">
        {isCorrect ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m15 9-6 6M9 9l6 6"/>
          </svg>
        )}
      </div>

      <p className="font-script text-5xl text-primary mb-6 [text-wrap:balance]" aria-live="polite">
        {isCorrect ? "正解！" : "不正解…"}
      </p>

      {/* スコアカード */}
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-[0_4px_24px_rgba(219,39,119,0.10)] border border-primary/10 p-6 text-center">
        <p className="text-4xl font-bold text-rose-text mb-1 [font-variant-numeric:tabular-nums]">+{yourAnswer.scoreAwarded}<span className="text-lg">点</span></p>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/30" />
          <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent/60" aria-hidden="true" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/30" />
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-rose-text/70 [font-variant-numeric:tabular-nums]">
          <p>回答速度: {(yourAnswer.responseTimeMs / 1000).toFixed(2)}秒</p>
          <p>累計スコア: {yourAnswer.totalScore.toLocaleString()}点</p>
          <p className="text-base font-bold text-rose-text mt-1">現在 第{yourAnswer.currentRank}位</p>
        </div>
      </div>

      {/* 正解表示 */}
      {correctAnswerText !== null ? (
        <div className="w-full max-w-xs bg-white rounded-2xl shadow-[0_4px_24px_rgba(219,39,119,0.10)] border border-primary/10 p-5 text-center mt-4">
          <p className="text-sm text-rose-text/60 mb-1">正解</p>
          <p className="text-lg font-bold text-primary">{correctAnswerText}</p>
        </div>
      ) : null}
    </div>
  );
}
