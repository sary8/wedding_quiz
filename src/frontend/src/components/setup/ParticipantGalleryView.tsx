import { useState, useEffect } from "react";
import type { ParticipantWithQuiz } from "../../types";
import { listAllParticipants, deleteParticipant, deleteParticipantsBulk, deleteAllParticipants } from "../../services/api";
import { cn } from "../../utils/cn";

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

export function ParticipantGalleryView() {
  const [participants, setParticipants] = useState<ParticipantWithQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"selected" | "all" | null>(null);

  useEffect(() => {
    loadParticipants();
  }, []);

  async function loadParticipants() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAllParticipants();
      setParticipants(data);
    } catch {
      setError("参加者の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  function makeKey(p: ParticipantWithQuiz): string {
    return `${p.quiz_id}-${p.id}`;
  }

  function toggleSelect(p: ParticipantWithQuiz) {
    const key = makeKey(p);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === participants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(participants.map(makeKey)));
    }
  }

  async function handleDeleteSelected() {
    setIsDeleting(true);
    setError(null);
    setConfirmMode(null);

    // quiz_idごとにグルーピング
    const grouped = new Map<number, number[]>();
    for (const p of participants) {
      if (selectedIds.has(makeKey(p))) {
        const list = grouped.get(p.quiz_id) ?? [];
        list.push(p.id);
        grouped.set(p.quiz_id, list);
      }
    }

    try {
      await Promise.all(
        Array.from(grouped, ([quizId, ids]) =>
          ids.length === 1
            ? deleteParticipant(quizId, ids[0])
            : deleteParticipantsBulk(quizId, ids),
        ),
      );
      setSelectedIds(new Set());
      const data = await listAllParticipants();
      setParticipants(data);
    } catch {
      setError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteAll() {
    setIsDeleting(true);
    setError(null);
    setConfirmMode(null);

    try {
      await deleteAllParticipants();
      setSelectedIds(new Set());
      const data = await listAllParticipants();
      setParticipants(data);
    } catch {
      setError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm flex flex-col items-center gap-2">
        <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-600 text-sm">読み込み中…</p>
      </div>
    );
  }

  if (error && participants.length === 0) {
    return (
      <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
        {error}
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <p className="text-gray-500">まだ参加者がいません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* 操作バー */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <label className={cn("flex items-center gap-2 cursor-pointer text-sm text-gray-700 min-h-[44px]", btnFocus)}>
          <input
            type="checkbox"
            checked={selectedIds.size === participants.length && participants.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 accent-accent cursor-pointer"
          />
          全選択
        </label>

        {selectedIds.size > 0 && (
          <span className="text-sm text-gray-500">{selectedIds.size}人選択中</span>
        )}

        <div className="flex-1" />

        {/* 選択削除 */}
        {confirmMode === "selected" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
              )}
            >
              {isDeleting ? "削除中…" : `${selectedIds.size}人を削除`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmMode(null)}
              disabled={isDeleting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
              )}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmMode("selected")}
            disabled={selectedIds.size === 0 || isDeleting}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[44px]",
              btnFocus,
              selectedIds.size > 0
                ? "text-red-600 hover:bg-red-50 cursor-pointer"
                : "text-gray-400 cursor-not-allowed",
            )}
          >
            選択した人を削除
          </button>
        )}

        {/* 全削除 */}
        {confirmMode === "all" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
              )}
            >
              {isDeleting ? "削除中…" : `全${participants.length}人を削除`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmMode(null)}
              disabled={isDeleting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer",
                btnFocus,
              )}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmMode("all")}
            disabled={isDeleting}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer",
              btnFocus,
            )}
          >
            全員削除
          </button>
        )}
      </div>

      {/* ギャラリー */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {participants.map((p) => {
          const key = makeKey(p);
          const isSelected = selectedIds.has(key);
          return (
            <label
              key={key}
              className={cn(
                "bg-white rounded-xl p-4 shadow-sm flex flex-col items-center text-center cursor-pointer transition-[border-color,box-shadow] duration-150 border-2",
                isSelected ? "border-accent shadow-md" : "border-transparent hover:border-gray-200",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(p)}
                className="sr-only"
                aria-label={`${p.nickname}を選択`}
              />
              {p.selfie_file_name ? (
                <img
                  src={`/api/media/${p.selfie_file_name}`}
                  alt={`${p.nickname}のアバター`}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover mb-3"
                />
              ) : (
                <span className="w-20 h-20 rounded-full bg-accent/20 text-accent flex items-center justify-center text-2xl font-bold mb-3">
                  {p.nickname.charAt(0)}
                </span>
              )}
              <div className="font-semibold text-sm text-gray-800 truncate w-full">{p.nickname}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate w-full">{p.quiz_title}</div>
              {p.total_score > 0 && (
                <div className="text-xs text-accent font-medium mt-1">{p.total_score}点</div>
              )}
              {isSelected && (
                <div className="mt-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
