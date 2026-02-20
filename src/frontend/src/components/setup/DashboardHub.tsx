import { useState } from "react";
import type { QuizSummary } from "../../types";
import { QuizStatus } from "../../types";
import { deleteQuiz } from "../../services/api";
import { cn } from "../../utils/cn";

type SetupView = "history" | "participants" | "questions" | "edit" | "host";

type Props = {
  quizList: QuizSummary[];
  onCreateQuiz: (title: string) => Promise<void>;
  onNavigate: (view: SetupView, quizId?: number) => void;
  onQuizDeleted: () => void;
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

export function DashboardHub({ quizList, onCreateQuiz, onNavigate, onQuizDeleted }: Props) {
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const drafts = quizList.filter((q) => q.status === QuizStatus.Draft);
  const active = quizList.filter((q) => q.status === QuizStatus.Lobby || q.status === QuizStatus.InProgress);
  const finished = quizList.filter((q) => q.status === QuizStatus.Finished);

  const totalParticipants = quizList.reduce((sum, q) => sum + q.participant_count, 0);
  const finishedQuestions = finished.reduce((sum, q) => sum + q.question_count, 0);

  async function handleDeleteQuiz(id: number) {
    setIsDeleting(true);
    setDeleteError(null);
    setPendingDeleteId(null);
    try {
      await deleteQuiz(id);
      onQuizDeleted();
    } catch {
      setDeleteError("ゲームの削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

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

      {deleteError && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
          {deleteError}
        </div>
      )}

      {/* 下書き */}
      {drafts.length > 0 && (
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-3 text-gray-800">編集中のゲーム</h2>
          <div className="flex flex-col gap-2">
            {drafts.map((q) => (
              <div
                key={q.id}
                className="px-4 py-3 rounded-lg bg-gray-50 flex justify-between items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => onNavigate("edit", q.id)}
                  className={cn(
                    "flex-1 text-left min-w-0 cursor-pointer rounded-lg p-1 -m-1 hover:bg-gray-100 transition-colors duration-150",
                    btnFocus,
                  )}
                >
                  <div className="font-semibold text-base text-gray-800">{q.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2", statusBadgeClass(q.status))}>
                      {statusLabel(q.status)}
                    </span>
                    {q.question_count}問
                  </div>
                </button>
                <span className="text-sm text-accent font-medium shrink-0">編集 →</span>
                {pendingDeleteId === q.id ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(q.id)}
                      disabled={isDeleting}
                      className={cn("px-3 py-1.5 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                    >
                      {isDeleting ? "削除中…" : "確認"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      disabled={isDeleting}
                      className={cn("px-3 py-1.5 rounded text-xs text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                    >
                      戻る
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(q.id)}
                    aria-label={`「${q.title}」を削除`}
                    className={cn("px-3 py-1.5 rounded text-xs text-red-500 hover:bg-red-50 transition-colors duration-150 min-h-[36px] cursor-pointer shrink-0", btnFocus)}
                  >
                    削除
                  </button>
                )}
              </div>
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
                className="px-4 py-3 rounded-lg bg-green-50 border-2 border-green-200 flex flex-wrap justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-base text-gray-800">{q.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2", statusBadgeClass(q.status))}>
                      {statusLabel(q.status)}
                    </span>
                    {q.participant_count}人参加 ・ ルーム: {q.room_code}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigate("host", q.id)}
                    className={cn(
                      "text-sm text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors duration-150 min-h-[36px] cursor-pointer",
                      btnFocus,
                    )}
                  >
                    ホスト画面へ →
                  </button>
                  {pendingDeleteId === q.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(q.id)}
                        disabled={isDeleting}
                        className={cn("px-3 py-1.5 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                      >
                        {isDeleting ? "削除中…" : "確認"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        disabled={isDeleting}
                        className={cn("px-3 py-1.5 rounded text-xs text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                      >
                        戻る
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(q.id)}
                      aria-label={`「${q.title}」を削除`}
                      className={cn("px-3 py-1.5 rounded text-xs text-red-500 hover:bg-red-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                    >
                      削除
                    </button>
                  )}
                </div>
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent mb-2" aria-hidden="true">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 12h6" /><path d="M9 16h6" />
          </svg>
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent mb-2" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent mb-2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          <div className="font-semibold text-gray-800">問題ライブラリ</div>
          <div className="text-sm text-gray-500 mt-1">{finishedQuestions > 0 ? `${finishedQuestions}問` : "テンプレート・過去問"}</div>
        </button>
      </div>
    </div>
  );
}
