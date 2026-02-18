import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes } from "../../services/api";
import type { Quiz, QuizSummary } from "../../types";
import { NewQuizForm } from "../../components/setup/NewQuizForm";
import { QuizSelector } from "../../components/setup/QuizSelector";
import { TabBar } from "../../components/setup/TabBar";
import { QuizConfigTab } from "../../components/setup/QuizConfigTab";
import { QuestionManagementTab } from "../../components/setup/QuestionManagementTab";

function saveHostSecret(quizId: number, secret: string) {
  localStorage.setItem(`host_secret_${quizId}`, secret);
}

function getHostSecret(quizId: number): string | null {
  return localStorage.getItem(`host_secret_${quizId}`);
}

function parseTab(value: string | null): "config" | "questions" {
  return value === "questions" ? "questions" : "config";
}

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quizList, setQuizList] = useState<QuizSummary[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuizList, setIsLoadingQuizList] = useState(true);
  const [isSelectingQuiz, setIsSelectingQuiz] = useState(false);
  const [error, setError] = useState("");

  const activeTab = parseTab(searchParams.get("tab"));
  function setActiveTab(tab: "config" | "questions") {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "config") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function loadQuizzes() {
    setIsLoadingQuizList(true);
    try {
      const data = await listQuizzes();
      setQuizList(data);
    } catch {
      setError("クイズ一覧の取得に失敗しました");
    } finally {
      setIsLoadingQuizList(false);
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
      setActiveTab("questions");
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
    setIsSelectingQuiz(true);
    try {
      const quiz = await getQuiz(summary.id, key);
      setSelectedQuiz(quiz);
      setActiveTab("config");
    } catch {
      setError("クイズの取得に失敗しました（キーが不正な可能性があります）");
    } finally {
      setIsSelectingQuiz(false);
    }
  }

  function handleChangeQuiz() {
    setSelectedQuiz(null);
    setActiveTab("config");
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

  const handleTitleSaved = useCallback(async () => {
    await loadQuizzes();
    await handleQuestionUpdate();
  }, [handleQuestionUpdate]);

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

        {selectedQuiz ? (
          /* クイズ選択後: タブ表示 */
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
            <div
              id="tabpanel-config"
              role="tabpanel"
              aria-labelledby="tab-config"
              hidden={activeTab !== "config"}
            >
              {activeTab === "config" && (
                <QuizConfigTab
                  quiz={selectedQuiz}
                  onTitleSaved={handleTitleSaved}
                  onStartLobby={handleStartLobby}
                  onChangeQuiz={handleChangeQuiz}
                  getHostSecret={getHostSecret}
                />
              )}
            </div>
            <div
              id="tabpanel-questions"
              role="tabpanel"
              aria-labelledby="tab-questions"
              hidden={activeTab !== "questions"}
            >
              {activeTab === "questions" && (
                <QuestionManagementTab
                  quiz={selectedQuiz}
                  onUpdate={handleQuestionUpdate}
                />
              )}
            </div>
          </div>
        ) : (
          /* クイズ未選択時: 新規作成 + 既存一覧 */
          <>
            <NewQuizForm isLoading={isLoading} onCreateQuiz={handleCreateQuiz} />
            {isLoadingQuizList ? (
              <div className="text-center py-8 text-gray-500 text-sm">読み込み中…</div>
            ) : (
              <QuizSelector
                quizList={quizList}
                isSelectingQuiz={isSelectingQuiz}
                onSelectQuiz={handleSelectQuiz}
                getHostSecret={getHostSecret}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
