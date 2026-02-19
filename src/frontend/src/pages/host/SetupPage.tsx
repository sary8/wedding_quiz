import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes } from "../../services/api";
import type { Quiz, QuizSummary } from "../../types";
import { DashboardHub } from "../../components/setup/DashboardHub";
import { GameHistoryView } from "../../components/setup/GameHistoryView";
import { ParticipantGalleryView } from "../../components/setup/ParticipantGalleryView";
import { QuestionLibraryView } from "../../components/setup/QuestionLibraryView";
import { TabBar } from "../../components/setup/TabBar";
import { QuizConfigTab } from "../../components/setup/QuizConfigTab";
import { cn } from "../../utils/cn";

const QuestionManagementTab = lazy(() =>
  import("../../components/setup/QuestionManagementTab").then((m) => ({ default: m.QuestionManagementTab })),
);

type SetupView = "dashboard" | "history" | "participants" | "questions" | "edit";

function parseView(value: string | null): SetupView {
  if (value === "history" || value === "participants" || value === "questions" || value === "edit") {
    return value;
  }
  return "dashboard";
}

function parseTab(value: string | null): "config" | "questions" {
  return value === "questions" ? "questions" : "config";
}

const VIEW_TITLES: Record<Exclude<SetupView, "dashboard" | "edit">, string> = {
  history: "ゲーム履歴",
  participants: "参加者一覧",
  questions: "問題ライブラリ",
};

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quizList, setQuizList] = useState<QuizSummary[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isLoadingQuizList, setIsLoadingQuizList] = useState(true);
  const [error, setError] = useState("");

  const currentView = parseView(searchParams.get("view"));
  const editQuizId = searchParams.get("quizId");
  const activeTab = parseTab(searchParams.get("tab"));

  function setView(view: SetupView, quizId?: number) {
    setSearchParams(() => {
      const next = new URLSearchParams();
      if (view !== "dashboard") {
        next.set("view", view);
      }
      if (view === "edit" && quizId) {
        next.set("quizId", String(quizId));
      }
      return next;
    }, { replace: true });
  }

  function setActiveTab(tab: "config" | "questions") {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "config") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  }

  function goToDashboard() {
    setSelectedQuiz(null);
    setView("dashboard");
  }

  useEffect(() => {
    loadQuizzes();
  }, []);

  // view=edit でquizIdがある場合、自動でクイズをロード
  useEffect(() => {
    if (currentView === "edit" && editQuizId && !selectedQuiz) {
      const id = Number(editQuizId);
      getQuiz(id)
        .then((quiz) => setSelectedQuiz(quiz))
        .catch(() => setError("クイズの取得に失敗しました"));
    }
  }, [currentView, editQuizId, selectedQuiz]);

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
    setError("");
    try {
      const quiz = await createQuiz(title);
      await loadQuizzes();
      setSelectedQuiz(quiz);
      setView("edit", quiz.id);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "questions");
        return next;
      }, { replace: true });
    } catch {
      setError("クイズの作成に失敗しました");
    }
  }

  function handleNavigate(view: "history" | "participants" | "questions" | "edit", quizId?: number) {
    if (view === "edit" && quizId) {
      getQuiz(quizId)
        .then((quiz) => {
          setSelectedQuiz(quiz);
          setView("edit", quizId);
        })
        .catch(() => setError("クイズの取得に失敗しました"));
    } else {
      setView(view);
    }
  }

  function handleChangeQuiz() {
    setSelectedQuiz(null);
    setView("dashboard");
  }

  const handleStartLobby = useCallback(() => {
    if (!selectedQuiz) return;
    navigate(`/host/${selectedQuiz.room_code}?quizId=${selectedQuiz.id}`);
  }, [selectedQuiz, navigate]);

  const handleQuestionUpdate = useCallback(async () => {
    if (!selectedQuiz) return;
    const [updated] = await Promise.all([getQuiz(selectedQuiz.id), loadQuizzes()]);
    setSelectedQuiz(updated);
  }, [selectedQuiz]);

  const handleTitleSaved = useCallback(async () => {
    if (selectedQuiz) {
      const [, updated] = await Promise.all([loadQuizzes(), getQuiz(selectedQuiz.id)]);
      setSelectedQuiz(updated);
    } else {
      await loadQuizzes();
    }
  }, [selectedQuiz]);

  const headerSubtext = currentView === "dashboard"
    ? "ホスト管理"
    : currentView === "edit"
      ? selectedQuiz?.title ?? "クイズ編集"
      : VIEW_TITLES[currentView];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-primary to-primary-dark py-6 mb-8">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3">
            {currentView !== "dashboard" && (
              <button
                type="button"
                onClick={goToDashboard}
                aria-label="ダッシュボードに戻る"
                className={cn(
                  "text-white/80 hover:text-white text-sm transition-colors duration-150 cursor-pointer py-1 px-2 -ml-2 rounded",
                  btnFocus,
                )}
              >
                ← 戻る
              </button>
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-white m-0">Wedding Quiz</h1>
              <p className="text-white/80 mt-1 text-sm">{headerSubtext}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12">
        {error && (
          <div role="alert" className="p-3 mb-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
            {error}
          </div>
        )}

        {isLoadingQuizList && currentView === "dashboard" ? (
          <div className="text-center py-8 text-gray-500 text-sm">読み込み中…</div>
        ) : (
          <>
            {currentView === "dashboard" && (
              <DashboardHub
                quizList={quizList}
                onCreateQuiz={handleCreateQuiz}
                onNavigate={handleNavigate}
                onQuizDeleted={loadQuizzes}
              />
            )}

            {currentView === "history" && (
              <GameHistoryView
                quizList={quizList}
                onQuizDeleted={loadQuizzes}
              />
            )}

            {currentView === "participants" && (
              <ParticipantGalleryView />
            )}

            {currentView === "questions" && (
              <QuestionLibraryView
                quizList={quizList}
              />
            )}

            {currentView === "edit" && selectedQuiz && (
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
                    <Suspense fallback={<div className="text-center py-8 text-gray-500 text-sm">読み込み中…</div>}>
                      <QuestionManagementTab
                        quiz={selectedQuiz}
                        onUpdate={handleQuestionUpdate}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
