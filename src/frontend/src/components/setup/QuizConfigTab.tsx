import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Quiz } from "../../types";
import { updateQuiz, deleteQuiz, setTeams as setTeamsApi } from "../../services/api";
import { cn } from "../../utils/cn";

type Props = {
  quiz: Quiz;
  onTitleSaved: () => void;
  onStartLobby: (mode?: "rehearsal") => void;
  onChangeQuiz: () => void;
  onDeleted: () => void;
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

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

export function QuizConfigTab({ quiz, onTitleSaved, onStartLobby, onChangeQuiz, onDeleted }: Props) {
  const navigate = useNavigate();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const [teamCount, setTeamCount] = useState<number>(() => {
    const existing = quiz.teams ?? [];
    return existing.length >= 2 ? existing.length : 4;
  });
  const [isSavingTeams, setIsSavingTeams] = useState(false);

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

  async function handleSaveTeams() {
    setIsSavingTeams(true);
    setError("");
    try {
      const teams = Array.from({ length: teamCount }, (_, i) => ({
        name: String.fromCharCode(65 + i),
      }));
      await setTeamsApi(quiz.id, teams);
    } catch {
      setError("チームの保存に失敗しました");
    } finally {
      setIsSavingTeams(false);
    }
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
            className="group flex items-center gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg p-1"
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

      {/* チーム設定 */}
      <div className="border border-gray-100 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-1">チーム設定</h3>
        <p className="text-xs text-gray-400 mb-4">チーム数を設定します（2〜26）。参加者は A〜Z のレター名チームに配属されます。</p>

        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => setTeamCount((n) => Math.max(2, n - 1))}
            disabled={teamCount <= 2}
            aria-label="チーム数を減らす"
            className={cn(
              "w-10 h-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors duration-150 cursor-pointer",
              btnFocus,
              teamCount <= 2 && "opacity-40 cursor-not-allowed",
            )}
          >
            −
          </button>
          <input
            type="number"
            min={2}
            max={26}
            value={teamCount}
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value));
              if (v >= 2 && v <= 26) setTeamCount(v);
            }}
            aria-label="チーム数"
            className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-center text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent"
          />
          <button
            type="button"
            onClick={() => setTeamCount((n) => Math.min(26, n + 1))}
            disabled={teamCount >= 26}
            aria-label="チーム数を増やす"
            className={cn(
              "w-10 h-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors duration-150 cursor-pointer",
              btnFocus,
              teamCount >= 26 && "opacity-40 cursor-not-allowed",
            )}
          >
            ＋
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {Array.from({ length: teamCount }, (_, i) => String.fromCharCode(65 + i)).join("・")}
          {" "}の {teamCount} 個のチームを作成
        </p>

        <button
          type="button"
          onClick={handleSaveTeams}
          disabled={isSavingTeams}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold text-white bg-accent hover:bg-accent/90 transition-colors duration-150 min-h-[44px] cursor-pointer",
            btnFocus,
            isSavingTeams && "opacity-60 cursor-not-allowed",
          )}
        >
          {isSavingTeams ? "保存中…" : "チームを保存"}
        </button>
      </div>

      {/* プレビュー / リハーサル */}
      {canStartLobby && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/host/${quiz.id}/preview`)}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold border-2 border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors duration-200 min-h-[44px] cursor-pointer",
              btnFocus,
            )}
          >
            プレビュー
          </button>
          <button
            type="button"
            onClick={() => onStartLobby("rehearsal")}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold border-2 border-yellow-400 text-yellow-800 bg-yellow-50 hover:bg-yellow-100 transition-colors duration-200 min-h-[44px] cursor-pointer",
              btnFocus,
            )}
          >
            リハーサル
          </button>
        </div>
      )}

      {/* ロビーを開く */}
      <div>
        <button
          type="button"
          onClick={() => onStartLobby()}
          disabled={!canStartLobby}
          className={[
            "w-full py-4 rounded-xl text-lg font-bold text-white transition-opacity duration-200 min-h-[44px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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

      {/* フッター */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <button
          type="button"
          onClick={onChangeQuiz}
          className={cn("text-sm text-gray-500 hover:text-accent transition-colors duration-150 underline cursor-pointer py-2 px-4 min-h-[44px] rounded-lg", btnFocus)}
        >
          別のクイズを選択
        </button>

        {pendingDelete ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setIsDeleting(true);
                setError("");
                try {
                  await deleteQuiz(quiz.id);
                  onDeleted();
                } catch {
                  setError("ゲームの削除に失敗しました");
                  setPendingDelete(false);
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
            >
              {isDeleting ? "削除中…" : "本当に削除する"}
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(false)}
              disabled={isDeleting}
              className={cn("px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPendingDelete(true)}
            className={cn("px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
          >
            このゲームを削除
          </button>
        )}
      </div>
    </div>
  );
}
