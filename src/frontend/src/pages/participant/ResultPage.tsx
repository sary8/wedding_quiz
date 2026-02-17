import type { QuestionResultData } from "../../types";

type Props = {
  result: QuestionResultData | null;
};

export function ResultPage({ result }: Props) {
  if (!result?.yourAnswer) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white">
        <p className="text-2xl">未回答</p>
        <p className="text-base text-gray-400 mt-2">次の問題をお待ちください</p>
      </div>
    );
  }

  const { yourAnswer } = result;
  const isCorrect = yourAnswer.isCorrect;

  return (
    <div
      className={[
        "h-[100dvh] flex flex-col items-center justify-center text-white p-6",
        isCorrect
          ? "bg-gradient-to-br from-[#43a047] to-[#66bb6a]"
          : "bg-gradient-to-br from-[#e53935] to-[#ef5350]",
      ].join(" ")}
    >
      <div aria-hidden="true" className="mb-4">
        {isCorrect ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m15 9-6 6M9 9l6 6"/>
          </svg>
        )}
      </div>
      <p className="text-3xl font-bold mb-6" aria-live="polite">
        {isCorrect ? "正解！" : "不正解..."}
      </p>

      <div className="bg-black/20 rounded-2xl p-6 text-center min-w-[240px]">
        <p className="text-4xl font-bold mb-3">+{yourAnswer.scoreAwarded}点</p>
        <p className="text-base mb-2">回答速度: {(yourAnswer.responseTimeMs / 1000).toFixed(2)}秒</p>
        <p className="text-base mb-2">累計スコア: {yourAnswer.totalScore.toLocaleString()}点</p>
        <p className="text-xl font-bold">現在 第{yourAnswer.currentRank}位</p>
      </div>
    </div>
  );
}
