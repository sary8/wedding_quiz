import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes, checkAuthStatus, checkPinRequired, isAdminAuthenticated } from "../../services/api";
import type { Quiz, QuizSummary } from "../../types";
import { AdminLoginForm } from "../../components/setup/AdminLoginForm";
import { DashboardHub } from "../../components/setup/DashboardHub";
import { GameHistoryView } from "../../components/setup/GameHistoryView";
import { ParticipantGalleryView } from "../../components/setup/ParticipantGalleryView";
import { QuestionLibraryView } from "../../components/setup/QuestionLibraryView";
import { StatsView } from "../../components/setup/StatsView";
import { TabBar } from "../../components/setup/TabBar";
import { QuizConfigTab } from "../../components/setup/QuizConfigTab";
import { cn } from "../../utils/cn";

const QuestionManagementTab = lazy(() =>
  import("../../components/setup/QuestionManagementTab").then((m) => ({ default: m.QuestionManagementTab })),
);

type SetupView = "dashboard" | "history" | "participants" | "questions" | "stats" | "edit";

function parseView(value: string | null): SetupView {
  if (value === "history" || value === "participants" || value === "questions" || value === "stats" || value === "edit") {
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
  stats: "統計ダッシュボード",
};

const btnFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quizList, setQuizList] = useState<QuizSummary[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isLoadingQuizList, setIsLoadingQuizList] = useState(true);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isPinRequired, setIsPinRequired] = useState(false);

  // 初回マウント時にセッション状態を確認（PIN要否を並列フェッチ）
  useEffect(() => {
    async function checkAuth() {
      if (isAdminAuthenticated()) {
        const [valid, pinRequired] = await Promise.all([
          checkAuthStatus(),
          checkPinRequired(),
        ]);
        setIsAuthenticated(valid);
        if (!valid) {
          setIsPinRequired(pinRequired);
        }
      } else {
        setIsPinRequired(await checkPinRequired());
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  const currentView = parseView(searchParams.get("view"));
  const editQuizId = searchParams.get("quizId");
  const activeTab = parseTab(searchParams.get("tab"));

  const setView = useCallback((view: SetupView, quizId?: number) => {
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
  }, [setSearchParams]);

  const setActiveTab = useCallback((tab: "config" | "questions") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "config") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const goToDashboard = useCallback(() => {
    setSelectedQuiz(null);
    setView("dashboard");
  }, [setView]);

  const loadQuizzes = useCallback(async () => {
    setIsLoadingQuizList(true);
    try {
      const data = await listQuizzes();
      setQuizList(data);
    } catch {
      setError("クイズ一覧の取得に失敗しました");
    } finally {
      setIsLoadingQuizList(false);
    }
  }, []);

  // 認証済みの場合のみクイズ一覧をロード
  useEffect(() => {
    if (isAuthenticated) {
      loadQuizzes();
    }
  }, [isAuthenticated, loadQuizzes]);

  // view=edit でquizIdがある場合、認証済みなら自動でクイズをロード
  useEffect(() => {
    if (isAuthenticated && currentView === "edit" && editQuizId && !selectedQuiz) {
      const id = Number(editQuizId);
      getQuiz(id)
        .then((quiz) => setSelectedQuiz(quiz))
        .catch(() => setError("クイズの取得に失敗しました"));
    }
  }, [isAuthenticated, currentView, editQuizId, selectedQuiz]);

  const handleCreateQuiz = useCallback(async (title: string) => {
    setError("");
    try {
      const quiz = await createQuiz(title);
      if (quiz.host_secret) {
        sessionStorage.setItem(`host_secret_${quiz.room_code}`, quiz.host_secret);
      }
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
  }, [loadQuizzes, setView, setSearchParams]);

  const handleNavigate = useCallback((view: "history" | "participants" | "questions" | "stats" | "edit" | "host", quizId?: number) => {
    if (view === "host" && quizId) {
      getQuiz(quizId)
        .then((quiz) => {
          if (quiz.host_secret) {
            sessionStorage.setItem(`host_secret_${quiz.room_code}`, quiz.host_secret);
          }
          navigate(`/host/${quiz.room_code}?quizId=${quiz.id}`);
        })
        .catch(() => setError("クイズの取得に失敗しました"));
    } else if (view === "edit" && quizId) {
      getQuiz(quizId)
        .then((quiz) => {
          setSelectedQuiz(quiz);
          setView("edit", quizId);
        })
        .catch(() => setError("クイズの取得に失敗しました"));
    } else {
      setView(view as SetupView);
    }
  }, [navigate, setView]);

  const handleChangeQuiz = useCallback(() => {
    setSelectedQuiz(null);
    setView("dashboard");
  }, [setView]);

  const handleQuizDeleted = useCallback(async () => {
    setSelectedQuiz(null);
    await loadQuizzes();
    setView("dashboard");
  }, [loadQuizzes, setView]);

  const selectedQuizId = selectedQuiz?.id;
  const selectedQuizRoomCode = selectedQuiz?.room_code;

  const handleStartLobby = useCallback(async (mode?: "rehearsal") => {
    if (!selectedQuizRoomCode || !selectedQuizId) return;
    // sessionStorageにない場合はAPIから取得
    if (!sessionStorage.getItem(`host_secret_${selectedQuizRoomCode}`)) {
      try {
        const quiz = await getQuiz(selectedQuizId);
        if (quiz.host_secret) {
          sessionStorage.setItem(`host_secret_${quiz.room_code}`, quiz.host_secret);
        }
      } catch {
        setError("クイズの取得に失敗しました");
        return;
      }
    }
    const base = `/host/${selectedQuizRoomCode}?quizId=${selectedQuizId}`;
    navigate(mode === "rehearsal" ? `${base}&rehearsal=true` : base);
  }, [selectedQuizId, selectedQuizRoomCode, navigate]);

  const handleQuestionUpdate = useCallback(async () => {
    if (!selectedQuizId) return;
    try {
      const [updated] = await Promise.all([getQuiz(selectedQuizId), loadQuizzes()]);
      setSelectedQuiz(updated);
    } catch {
      setError("問題の更新に失敗しました");
    }
  }, [selectedQuizId, loadQuizzes]);

  const handleTitleSaved = useCallback(async () => {
    try {
      if (selectedQuizId) {
        const [, updated] = await Promise.all([loadQuizzes(), getQuiz(selectedQuizId)]);
        setSelectedQuiz(updated);
      } else {
        await loadQuizzes();
      }
    } catch {
      setError("クイズの更新に失敗しました");
    }
  }, [selectedQuizId, loadQuizzes]);

  const headerSubtext = currentView === "dashboard"
    ? "ホスト管理"
    : currentView === "edit"
      ? selectedQuiz?.title ?? "クイズ編集"
      : VIEW_TITLES[currentView];

  // 認証状態チェック中
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  // 未認証 → ログインフォーム表示
  if (!isAuthenticated) {
    return (
      <AdminLoginForm
        isPinRequired={isPinRequired}
        onAuthenticated={() => setIsAuthenticated(true)}
      />
    );
  }

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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                {" "}戻る
              </button>
            )}
            <div>
              <h1 className="text-3xl font-extrabold text-white m-0 [text-wrap:balance]">Wedding Quiz</h1>
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
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="h-10 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
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

            {currentView === "stats" && (
              <StatsView quizList={quizList} />
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
                      onDeleted={handleQuizDeleted}
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
