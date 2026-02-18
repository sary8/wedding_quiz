import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes, updateQuiz } from "../../services/api";
import type { Quiz, QuizSummary } from "../../types";
import { QuizSelector } from "../../components/setup/QuizSelector";
import { QuestionList } from "../../components/setup/QuestionList";

// host_secretをlocalStorageに保存/取得
function saveHostSecret(quizId: number, secret: string) {
  localStorage.setItem(`host_secret_${quizId}`, secret);
}
function getHostSecret(quizId: number): string | null {
  return localStorage.getItem(`host_secret_${quizId}`);
}

export function SetupPage() {
  const navigate = useNavigate();
  const [quizList, setQuizList] = useState<QuizSummary[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function loadQuizzes() {
    try {
      const data = await listQuizzes();
      setQuizList(data);
    } catch {
      setError("クイズ一覧の取得に失敗しました");
    }
  }

  async function handleCreateQuiz(title: string) {
    setIsLoading(true);
    setError("");
    try {
      const quiz = await createQuiz(title);
      saveHostSecret(quiz.id, quiz.host_secret);
      await loadQuizzes();
      setSelectedQuiz(quiz);
    } catch {
      setError("クイズの作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectQuiz(summary: QuizSummary) {
    setError("");
    const key = getHostSecret(summary.id);
    if (!key) {
      setError("このクイズの管理キーがありません（別のブラウザで作成された可能性があります）");
      return;
    }
    try {
      const quiz = await getQuiz(summary.id, key);
      setSelectedQuiz(quiz);
    } catch {
      setError("クイズの取得に失敗しました（キーが不正な可能性があります）");
    }
  }

  const handleStartLobby = useCallback(() => {
    if (!selectedQuiz) return;
    navigate(`/host/${selectedQuiz.room_code}?key=${selectedQuiz.host_secret}&quizId=${selectedQuiz.id}`);
  }, [selectedQuiz, navigate]);

  const handleQuestionUpdate = useCallback(async () => {
    if (!selectedQuiz) return;
    const key = getHostSecret(selectedQuiz.id);
    if (key) {
      const updated = await getQuiz(selectedQuiz.id, key);
      setSelectedQuiz(updated);
    }
  }, [selectedQuiz]);

  // Title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  function handleStartEditTitle() {
    if (!selectedQuiz) return;
    setEditTitle(selectedQuiz.title);
    setIsEditingTitle(true);
  }

  async function handleSaveTitle() {
    if (!selectedQuiz || !editTitle.trim()) return;
    const key = getHostSecret(selectedQuiz.id);
    if (!key) return;
    try {
      await updateQuiz(selectedQuiz.id, key, editTitle.trim());
      setIsEditingTitle(false);
      await loadQuizzes();
      await handleQuestionUpdate();
    } catch {
      setError("タイトルの更新に失敗しました");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-primary to-primary-dark py-6 mb-8">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-3xl font-extrabold text-white m-0">Wedding Quiz</h1>
          <p className="text-white/80 mt-1 text-sm">問題管理・セットアップ</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        {error && (
          <div role="alert" className="p-3 mb-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* ステップ表示 */}
        <div className="flex gap-3 mb-8">
          <StepBadge num={1} label="クイズ作成" active={!selectedQuiz} />
          <StepBadge num={2} label="問題追加" active={!!selectedQuiz} />
          <StepBadge num={3} label="ロビー開始" active={false} />
        </div>

        <QuizSelector
          quizList={quizList}
          selectedQuiz={selectedQuiz}
          isLoading={isLoading}
          onCreateQuiz={handleCreateQuiz}
          onSelectQuiz={handleSelectQuiz}
          getHostSecret={getHostSecret}
        />

        {/* 問題編集 */}
        {selectedQuiz && (
          <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSaveTitle();
                      if (e.key === "Escape") setIsEditingTitle(false);
                    }}
                    onBlur={handleSaveTitle}
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-lg border-2 border-accent text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  />
                </div>
              ) : (
                <h2 className="text-lg font-semibold m-0 text-gray-800 flex items-center gap-2">
                  「{selectedQuiz.title}」の問題（{selectedQuiz.questions?.length ?? 0}問）
                  <button
                    type="button"
                    onClick={handleStartEditTitle}
                    aria-label="クイズタイトルを編集"
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-150 text-gray-400 hover:text-gray-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M11.13 1.47a1.5 1.5 0 0 1 2.12 0l1.28 1.28a1.5 1.5 0 0 1 0 2.12L5.91 13.49a1.5 1.5 0 0 1-.7.4l-3.25.93a.5.5 0 0 1-.62-.62l.93-3.25a1.5 1.5 0 0 1 .4-.7L11.13 1.47z" />
                    </svg>
                  </button>
                </h2>
              )}
            </div>
            <QuestionList quiz={selectedQuiz} onUpdate={handleQuestionUpdate} />
          </section>
        )}

        {/* ロビー開始 */}
        {selectedQuiz && (selectedQuiz.questions?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={handleStartLobby}
            className="w-full py-5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white text-xl font-bold shadow-lg hover:opacity-95 transition-opacity duration-200 min-h-[44px]"
          >
            ロビーを開く（参加者受付開始）
          </button>
        )}

        {selectedQuiz && (selectedQuiz.questions?.length ?? 0) === 0 && (
          <p className="text-center py-6 text-gray-500 text-sm">
            問題を1つ以上追加するとロビーを開始できます
          </p>
        )}
      </div>
    </div>
  );
}

function StepBadge({ num, label, active }: { num: number; label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white",
          active ? "bg-accent" : "bg-gray-300",
        ].join(" ")}
      >
        {num}
      </div>
      <span className={["text-sm font-semibold", active ? "text-gray-800" : "text-gray-400"].join(" ")}>
        {label}
      </span>
    </div>
  );
}
