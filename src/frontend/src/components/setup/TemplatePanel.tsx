import { useState, useEffect } from "react";
import type { QuestionBankItem } from "../../types";
import { listBankQuestions, deleteBankQuestion } from "../../services/api";
import { cn } from "../../utils/cn";
import { CHOICE_LABELS } from "./constants";

type Props = {
  onImport: (bankQuestionIds: number[]) => Promise<void>;
  onClose: () => void;
};

export function TemplatePanel({ onImport, onClose }: Props) {
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50";

  useEffect(() => {
    loadBank();
  }, []);

  async function loadBank() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listBankQuestions();
      setBankQuestions(data);
    } catch {
      setError("テンプレートの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteBank(id: number) {
    setPendingDeleteId(null);
    try {
      await deleteBankQuestion(id);
      setBankQuestions((prev) => prev.filter((q) => q.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      setError("テンプレートからの削除に失敗しました");
    }
  }

  async function handleImport() {
    if (selectedIds.size === 0) return;
    setIsImporting(true);
    try {
      await onImport(Array.from(selectedIds));
      onClose();
    } catch {
      setError("テンプレートからのインポートに失敗しました");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-purple-800">テンプレート</h3>
        <button
          type="button"
          onClick={onClose}
          className={cn("text-sm text-purple-600 hover:text-purple-800 transition-colors duration-150 cursor-pointer py-2 px-3 min-h-[44px] rounded-lg", btnFocus)}
        >
          閉じる
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 py-6 text-center">読み込み中…</p>
      ) : bankQuestions.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          テンプレートに問題がありません。問題の編集画面から「テンプレートに保存」で問題を追加できます。
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 mb-4">
            {bankQuestions.map((q) => (
              <label
                key={q.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 cursor-pointer",
                  selectedIds.has(q.id) ? "bg-purple-100 border-purple-400" : "bg-white border-gray-200 hover:border-purple-300",
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  aria-label={`${q.text}を選択`}
                  className="mt-1 w-5 h-5 shrink-0 accent-purple-600 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800 truncate">{q.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    正解: {CHOICE_LABELS[q.correct_choice - 1]} ・ {q.time_limit_seconds}秒 ・ {q.points}点
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, ci) => (
                      <span key={ci} className={ci + 1 === q.correct_choice ? "font-semibold text-gray-600" : ""}>
                        {CHOICE_LABELS[ci]}.{c}{ci < 3 ? " / " : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {pendingDeleteId === q.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteBank(q.id)}
                        aria-label={`「${q.text}」をテンプレートから削除`}
                        className={cn("px-3 py-1.5 rounded text-xs text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                      >
                        確認
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className={cn("px-3 py-1.5 rounded text-xs text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                      >
                        戻る
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(q.id)}
                      aria-label={`「${q.text}」を削除`}
                      className={cn("px-3 py-1.5 rounded text-xs text-red-500 hover:bg-red-50 transition-colors duration-150 min-h-[36px] cursor-pointer", btnFocus)}
                    >
                      削除
                    </button>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={selectedIds.size === 0 || isImporting}
            className={cn(
              "w-full py-3 rounded-lg text-base font-bold text-white transition-colors duration-150 min-h-[44px]",
              btnFocus,
              selectedIds.size > 0 && !isImporting
                ? "bg-purple-600 hover:opacity-90 cursor-pointer"
                : "bg-gray-300 cursor-not-allowed",
            )}
          >
            {isImporting
              ? "インポート中…"
              : selectedIds.size > 0
                ? `選択した${selectedIds.size}問をインポート`
                : "問題を選択してください"}
          </button>
        </>
      )}
    </div>
  );
}
