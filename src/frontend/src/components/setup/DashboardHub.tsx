import { useState } from "react";
import type { QuizSummary } from "../../types";
import { QuizStatus } from "../../types";
import { cn } from "../../utils/cn";

type SetupView = "history" | "participants" | "questions" | "edit";

type Props = {
  quizList: QuizSummary[];
  onCreateQuiz: (title: string) => Promise<void>;
  onNavigate: (view: SetupView, quizId?: number) => void;
};

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

function statusLabel(status: string): string {
  switch (status) {
    case "draft": return "下書き";
    case "lobby": return "ロビー";
    case "in_progress": return "進行中";
    case "finished": return "終了";
    default: return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft": return "bg-gray-200 text-gray-700";
    case "lobby": return "bg-blue-100 text-blue-700";
    case "in_progress": return "bg-green-100 text-green-700";
    case "finished": return "bg-purple-100 text-purple-700";
    default: return "bg-gray-200 text-gray-700";
  }
}

export function DashboardHub({ quizList, onCreateQuiz, onNavigate }: Props) {
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const drafts = quizList.filter((q) => q.status === QuizStatus.Draft);
  const active = quizList.filter((q) => q.status === QuizStatus.Lobby || q.status === QuizStatus.InProgress);
  const finished = quizList.filter((q) => q.status === QuizStatus.Finished);

  const totalParticipants = quizList.reduce((sum, q) => sum + q.participant_count, 0);
  const totalQuestions = quizList.reduce((sum, q) => sum + q.question_count, 0);

  async function handleCreate() {
    if (!title.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await onCreateQuiz(title.trim());
      setTitle("");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 新規作成 */}
      <section className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">新しいゲームを作成</h2>
        <div className="flex gap-3">
          <input
            type="text"
            name="quiz-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：太郎＆花子 結婚式クイズ…"
            aria-label="クイズのタイトル"
            autoComplete="off"
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 text-base focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-[border-color,box-shadow] duration-200"
            onKeyDown={(e) => e.key === "Enter" && !isComposing && handleCreate()}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className={cn(
              "px-7 py-3 rounded-lg text-base font-bold text-white whitespace-nowrap transition-colors duration-200 min-h-[44px]",
              btnFocus,
              title.trim() && !isCreating
                ? "bg-accent hover:opacity-90 cursor-pointer"
                : "bg-gray-300 cursor-not-allowed",
            )}
          >
            {isCreating ? "作成中…" : "作成"}
          </button>
        </div>
      </section>

      {/* 下書き */}
      {drafts.length > 0 && (
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-3 text-gray-800">編集中のゲーム</h2>
          <div className="flex flex-col gap-2">
            {drafts.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => onNavigate("edit", q.id)}
                className={cn(
                  "px-4 py-3 rounded-lg border-2 border-transparent bg-gray-50 hover:border-accent/30 flex justify-between items-center text-left w-full transition-[border-color] duration-150 min-h-[44px] cursor-pointer",
                  btnFocus,
                )}
              >
                <div>
                  <div className="font-semibold text-base text-gray-800">{q.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2", statusBadgeClass(q.status))}>
                      {statusLabel(q.status)}
                    </span>
                    {q.question_count}問
                  </div>
                </div>
                <span className="text-sm text-accent font-medium shrink-0 ml-3">編集を続ける →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 進行中 */}
      {active.length > 0 && (
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-3 text-gray-800">進行中のゲーム</h2>
          <div className="flex flex-col gap-2">
            {active.map((q) => (
              <div
                key={q.id}
                className="px-4 py-3 rounded-lg bg-green-50 border-2 border-green-200 flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-base text-gray-800">{q.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2", statusBadgeClass(q.status))}>
                      {statusLabel(q.status)}
                    </span>
                    {q.participant_count}人参加 ・ ルーム: {q.room_code}
                  </div>
                </div>
                <a
                  href={`/host/${q.room_code}?quizId=${q.id}`}
                  className={cn(
                    "text-sm text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors duration-150 min-h-[36px] shrink-0 ml-3",
                    btnFocus,
                  )}
                >
                  ホスト画面へ →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ナビカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate("history")}
          className={cn(
            "bg-white rounded-xl p-6 shadow-sm text-left hover:shadow-md transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-accent/20",
            btnFocus,
          )}
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-semibold text-gray-800">ゲーム履歴</div>
          <div className="text-sm text-gray-500 mt-1">{finished.length}ゲーム</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("participants")}
          className={cn(
            "bg-white rounded-xl p-6 shadow-sm text-left hover:shadow-md transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-accent/20",
            btnFocus,
          )}
        >
          <div className="text-2xl mb-2">👥</div>
          <div className="font-semibold text-gray-800">参加者一覧</div>
          <div className="text-sm text-gray-500 mt-1">{totalParticipants}人</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("questions")}
          className={cn(
            "bg-white rounded-xl p-6 shadow-sm text-left hover:shadow-md transition-shadow duration-200 cursor-pointer border-2 border-transparent hover:border-accent/20",
            btnFocus,
          )}
        >
          <div className="text-2xl mb-2">❓</div>
          <div className="font-semibold text-gray-800">問題ライブラリ</div>
          <div className="text-sm text-gray-500 mt-1">{totalQuestions}問</div>
        </button>
      </div>
    </div>
  );
}
