import type { QuizSummary } from "../../types";

type Props = {
  quizList: QuizSummary[];
  onSelectQuiz: (summary: QuizSummary) => void;
  getHostSecret: (quizId: number) => string | null;
};

export function QuizSelector({ quizList, onSelectQuiz, getHostSecret }: Props) {
  if (quizList.length === 0) return null;

  return (
    <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">作成済みクイズ</h2>
      <div className="flex flex-col gap-2">
        {quizList.map((q) => {
          const hasKey = !!getHostSecret(q.id);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQuiz(q)}
              disabled={!hasKey}
              className={[
                "px-4 py-3 rounded-lg border-2 flex justify-between items-center text-left w-full transition-all duration-150 min-h-[44px]",
                "border-transparent bg-gray-50 hover:border-gray-200",
                !hasKey ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <div>
                <div className="font-semibold text-base text-gray-800">{q.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  ルーム: {q.room_code} ・ {statusLabel(q.status)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "draft": return "下書き";
    case "lobby": return "ロビー";
    case "in_progress": return "進行中";
    case "finished": return "終了";
    default: return status;
  }
}
