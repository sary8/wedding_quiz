import { useState, useCallback } from "react";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";
import type { QuizSummary, ParticipantSummary, Quiz } from "../../types";
import { QuizStatus } from "../../types";
import { getQuiz, listQuizParticipants, deleteQuiz } from "../../services/api";
import { cn } from "../../utils/cn";
import { CHOICE_LABELS } from "./constants";
import { exportQuizData } from "./exportUtils";

type Props = {
  quizList: QuizSummary[];
  onQuizDeleted: () => void;
};

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

export function GameHistoryView({ quizList, onQuizDeleted }: Props) {
  const finishedQuizzes = quizList.filter((q) => q.status === QuizStatus.Finished);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, { quiz: Quiz; participants: ParticipantSummary[] }>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = useCallback(async (quizId: number, format: "csv" | "json") => {
    setError(null);
    try {
      await exportQuizData(quizId, format);
    } catch {
      setError("エクスポートに失敗しました");
    }
  }, []);

  async function handleToggle(quizId: number) {
    if (expandedId === quizId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(quizId);

    if (detailCache[quizId]) return;

    setLoadingId(quizId);
    setError(null);
    try {
      const [quiz, participants] = await Promise.all([
        getQuiz(quizId),
        listQuizParticipants(quizId),
      ]);
      setDetailCache((prev) => ({ ...prev, [quizId]: { quiz, participants } }));
    } catch {
      setError("詳細の取得に失敗しました");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(quizId: number) {
    setIsDeleting(true);
    setError(null);
    setPendingDeleteId(null);
    try {
      await deleteQuiz(quizId);
      setDetailCache((prev) => {
        const next = { ...prev };
        delete next[quizId];
        return next;
      });
      if (expandedId === quizId) setExpandedId(null);
      onQuizDeleted();
    } catch {
      setError("ゲームの削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

  if (finishedQuizzes.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm text-center">
        <p className="text-gray-500">まだ完了したゲームはありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
          {error}
        </div>
      )}

      {finishedQuizzes.map((q) => {
        const isExpanded = expandedId === q.id;
        const detail = detailCache[q.id];
        const isLoading = loadingId === q.id;

        return (
          <div key={q.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => handleToggle(q.id)}
              aria-expanded={isExpanded}
              className={cn(
                "w-full px-5 py-4 flex justify-between items-center text-left cursor-pointer hover:bg-gray-50 transition-colors duration-150",
                btnFocus,
              )}
            >
              <div>
                <div className="font-semibold text-base text-gray-800">{q.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {new Date(q.created_at).toLocaleDateString("ja-JP")} ・ {q.participant_count}人参加 ・ {q.question_count}問
                </div>
              </div>
              <span className="text-gray-400 shrink-0 ml-3" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform duration-200", isExpanded && "rotate-180")}><path d="m6 9 6 6 6-6"/></svg>
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 px-5 py-4">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm text-gray-600 text-center">読み込み中…</p>
                  </div>
                ) : detail ? (
                  <div className="flex flex-col gap-4">
                    {/* 参加者ランキング */}
                    {detail.participants.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">参加者ランキング</h3>
                        <div className="flex flex-col gap-1">
                          {[...detail.participants]
                            .sort((a, b) => a.current_rank - b.current_rank || b.total_score - a.total_score)
                            .slice(0, 10)
                            .map((p, i) => (
                              <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                                <span className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                                  i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-gray-300 text-white" : i === 2 ? "bg-orange-300 text-white" : "bg-gray-200 text-gray-600",
                                )}>
                                  {p.current_rank > 0 ? p.current_rank : i + 1}
                                </span>
                                {p.selfie_file_name ? (
                                  <img
                                    src={sanitizeMediaUrl(`/api/media/${p.selfie_file_name}`) ?? undefined}
                                    alt={`${p.nickname}のアバター`}
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <span className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold shrink-0">
                                    {p.nickname.charAt(0)}
                                  </span>
                                )}
                                <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 truncate">{p.nickname}</span>
                                <span className="text-sm text-gray-500 shrink-0">{p.total_score}点</span>
                              </div>
                            ))}
                          {detail.participants.length > 10 && (
                            <p className="text-xs text-gray-500 text-center mt-1">
                              他{detail.participants.length - 10}人
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 出題された問題 */}
                    {detail.quiz.questions && detail.quiz.questions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">出題された問題</h3>
                        <div className="flex flex-col gap-1">
                          {detail.quiz.questions.map((question, qi) => (
                            <div key={question.id} className="px-3 py-2 rounded-lg bg-gray-50">
                              <div className="text-sm text-gray-800">
                                <span className="text-gray-400 mr-1">Q{qi + 1}.</span>
                                {question.text}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                正解: {CHOICE_LABELS[question.correct_choice - 1]}.{
                                  [question.choice1, question.choice2, question.choice3, question.choice4][question.correct_choice - 1]
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* エクスポート + 削除 */}
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleExport(q.id, "csv")}
                          className={cn("px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
                        >
                          CSV出力
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(q.id, "json")}
                          className={cn("px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
                        >
                          JSON出力
                        </button>
                      </div>
                    </div>

                    <div className="pt-3">
                      {pendingDeleteId === q.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(q.id)}
                            disabled={isDeleting}
                            className={cn("px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
                          >
                            {isDeleting ? "削除中…" : "本当に削除する"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            disabled={isDeleting}
                            className={cn("px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(q.id)}
                          className={cn("px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 min-h-[44px] cursor-pointer", btnFocus)}
                        >
                          このゲームを削除
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
