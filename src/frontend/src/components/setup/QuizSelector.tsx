import { useState } from "react";
import type { Quiz, QuizSummary } from "../../types";

type Props = {
  quizList: QuizSummary[];
  selectedQuiz: Quiz | null;
  isLoading: boolean;
  onCreateQuiz: (title: string) => Promise<void>;
  onSelectQuiz: (summary: QuizSummary) => void;
  getHostSecret: (quizId: number) => string | null;
};

export function QuizSelector({
  quizList,
  selectedQuiz,
  isLoading,
  onCreateQuiz,
  onSelectQuiz,
  getHostSecret,
}: Props) {
  const [title, setTitle] = useState("");

  async function handleCreate() {
    if (!title.trim()) return;
    await onCreateQuiz(title.trim());
    setTitle("");
  }

  return (
    <>
      {/* クイズ作成 */}
      <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">新しいクイズを作成</h2>
        <div className="flex gap-3">
          <input
            type="text"
            name="quiz-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：太郎＆花子 結婚式クイズ…"
            aria-label="クイズのタイトル"
            className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 text-base focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-[border-color,box-shadow] duration-200"
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleCreate()}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isLoading || !title.trim()}
            className={[
              "px-7 py-3 rounded-lg text-base font-bold text-white whitespace-nowrap transition-colors duration-200 min-h-[44px]",
              title.trim() && !isLoading
                ? "bg-accent hover:opacity-90 cursor-pointer"
                : "bg-gray-300 cursor-not-allowed",
            ].join(" ")}
          >
            {isLoading ? "作成中..." : "作成"}
          </button>
        </div>
      </section>

      {/* 既存クイズ一覧 */}
      {quizList.length > 0 && (
        <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">作成済みクイズ</h2>
          <div className="flex flex-col gap-2">
            {quizList.map((q) => {
              const isSelected = selectedQuiz?.id === q.id;
              const hasKey = !!getHostSecret(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelectQuiz(q)}
                  disabled={!hasKey}
                  aria-pressed={isSelected}
                  className={[
                    "px-4 py-3 rounded-lg border-2 flex justify-between items-center text-left w-full transition-all duration-150 min-h-[44px]",
                    isSelected
                      ? "border-accent bg-pink-50"
                      : "border-transparent bg-gray-50 hover:border-gray-200",
                    !hasKey ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-semibold text-base text-gray-800">{q.title}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      ルーム: {q.room_code} ・ {statusLabel(q.status)}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-semibold shrink-0">
                      選択中
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
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
