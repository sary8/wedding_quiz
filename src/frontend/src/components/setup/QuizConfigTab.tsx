import { useState } from "react";
import type { Quiz } from "../../types";
import { updateQuiz } from "../../services/api";

type Props = {
  quiz: Quiz;
  onTitleSaved: () => void;
  onStartLobby: () => void;
  onChangeQuiz: () => void;
};

function statusLabel(status: string): string {
  switch (status) {
    case "draft": return "下書き";
    case "lobby": return "ロビー";
    case "in_progress": return "進行中";
    case "finished": return "終了";
    default: return status;
  }
}

export function QuizConfigTab({ quiz, onTitleSaved, onStartLobby, onChangeQuiz }: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [error, setError] = useState("");

  const questionCount = quiz.questions?.length ?? 0;
  const canStartLobby = questionCount > 0;

  function handleStartEditTitle() {
    setEditTitle(quiz.title);
    setIsEditingTitle(true);
  }

  async function handleSaveTitle() {
    if (!editTitle.trim() || isSavingTitle) return;
    setIsSavingTitle(true);
    try {
      await updateQuiz(quiz.id, editTitle.trim());
      setIsEditingTitle(false);
      onTitleSaved();
    } catch {
      setError("タイトルの更新に失敗しました");
    } finally {
      setIsSavingTitle(false);
    }
  }

  function handleCancelEdit() {
    setIsEditingTitle(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <button
          type="button"
          onClick={() => setError("")}
          className="w-full px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
        >
          {error}（タップで閉じる）
        </button>
      )}

      {/* クイズタイトル */}
      <div className="border border-gray-100 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">クイズタイトル</h3>
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSaveTitle();
                if (e.key === "Escape") handleCancelEdit();
              }}
              onBlur={handleSaveTitle}
              name="quiz-title-edit"
              aria-label="クイズタイトル"
              autoComplete="off"
              autoFocus
              className="flex-1 px-3 py-2 rounded-lg border-2 border-accent text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            />
            {isSavingTitle && (
              <span className="text-sm text-gray-500">保存中…</span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEditTitle}
            aria-label="クイズタイトルを編集"
            className="group flex items-center gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg p-1 -m-1"
          >
            <span className="text-lg font-semibold text-gray-800">{quiz.title}</span>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
              className="text-gray-400 group-hover:text-gray-600 transition-colors duration-150"
            >
              <path d="M11.13 1.47a1.5 1.5 0 0 1 2.12 0l1.28 1.28a1.5 1.5 0 0 1 0 2.12L5.91 13.49a1.5 1.5 0 0 1-.7.4l-3.25.93a.5.5 0 0 1-.62-.62l.93-3.25a1.5 1.5 0 0 1 .4-.7L11.13 1.47z" />
            </svg>
          </button>
        )}
      </div>

      {/* クイズ情報 */}
      <div className="border border-gray-100 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">クイズ情報</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">ルームコード</span>
            <div className="font-bold text-lg text-gray-800 mt-0.5">{quiz.room_code}</div>
          </div>
          <div>
            <span className="text-gray-500">ステータス</span>
            <div className="font-semibold text-gray-800 mt-0.5">{statusLabel(quiz.status)}</div>
          </div>
          <div>
            <span className="text-gray-500">問題数</span>
            <div className="font-semibold text-gray-800 mt-0.5">{questionCount}問</div>
          </div>
        </div>
      </div>

      {/* ロビーを開く */}
      <div>
        <button
          type="button"
          onClick={onStartLobby}
          disabled={!canStartLobby}
          className={[
            "w-full py-4 rounded-xl text-lg font-bold text-white transition-opacity duration-200 min-h-[44px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            canStartLobby
              ? "bg-gradient-to-r from-primary to-primary-dark shadow-lg hover:opacity-95 cursor-pointer"
              : "bg-gray-300 cursor-not-allowed",
          ].join(" ")}
        >
          ロビーを開く（参加者受付開始）
        </button>
        {!canStartLobby && (
          <p className="text-center mt-3 text-gray-500 text-sm">
            問題を1つ以上追加するとロビーを開始できます
          </p>
        )}
      </div>

      {/* 別のクイズを選択 */}
      <div className="text-center">
        <button
          type="button"
          onClick={onChangeQuiz}
          className="text-sm text-gray-500 hover:text-accent transition-colors duration-150 underline cursor-pointer py-2 px-4 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg"
        >
          別のクイズを選択
        </button>
      </div>
    </div>
  );
}
