import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes, addQuestion, deleteQuestion, uploadMedia, updateQuestion, updateQuiz, reorderQuestions } from "../../services/api";
import type { Quiz, QuizSummary, Question } from "../../types";

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
  const [title, setTitle] = useState("");
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

  async function handleCreateQuiz() {
    if (!title.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      const quiz = await createQuiz(title.trim());
      saveHostSecret(quiz.id, quiz.host_secret);
      setTitle("");
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

        {/* クイズ作成セクション */}
        <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">新しいクイズを作成</h2>
          <div className="flex gap-3">
            <input
              type="text"
              name="quiz-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：太郎＆花子 結婚式クイズ…"
              aria-label="クイズのタイトル"
              className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 text-base focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-[border-color,box-shadow] duration-200"
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleCreateQuiz()}
            />
            <button
              type="button"
              onClick={handleCreateQuiz}
              disabled={isLoading || !title.trim()}
              className={[
                "px-7 py-3 rounded-lg text-base font-bold text-white whitespace-nowrap transition-colors duration-200 min-h-[44px]",
                title.trim() && !isLoading
                  ? "bg-accent hover:opacity-90 cursor-pointer"
                  : "bg-gray-300 cursor-not-allowed",
              ].join(" ")}
            >
              {isLoading ? "作成中..." : "作成"}
            </button>
          </div>
        </section>

        {/* 既存クイズ一覧 */}
        {quizList.length > 0 && (
          <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">作成済みクイズ</h2>
            <div className="flex flex-col gap-2">
              {quizList.map((q) => {
                const isSelected = selectedQuiz?.id === q.id;
                const hasKey = !!getHostSecret(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => handleSelectQuiz(q)}
                    disabled={!hasKey}
                    aria-pressed={isSelected}
                    className={[
                      "px-4 py-3 rounded-lg border-2 flex justify-between items-center text-left w-full transition-all duration-150 min-h-[44px]",
                      isSelected
                        ? "border-accent bg-pink-50"
                        : "border-transparent bg-gray-50 hover:border-gray-200",
                      !hasKey ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div>
                      <div className="font-semibold text-base text-gray-800">{q.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        ルーム: {q.room_code} ・ {statusLabel(q.status)}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="bg-accent text-white px-3 py-1 rounded-full text-xs font-semibold shrink-0">
                        選択中
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

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
            <QuestionEditor
              quiz={selectedQuiz}
              onUpdate={handleQuestionUpdate}
            />
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

function statusLabel(status: string): string {
  switch (status) {
    case "draft": return "下書き";
    case "lobby": return "ロビー";
    case "in_progress": return "進行中";
    case "finished": return "終了";
    default: return status;
  }
}

const CHOICE_BG_CLASSES = ["bg-choice-red", "bg-choice-blue", "bg-choice-green", "bg-choice-yellow"];
const CHOICE_BORDER_CLASSES = ["border-choice-red", "border-choice-blue", "border-choice-green", "border-choice-yellow"];
const CHOICE_TEXT_CLASSES = ["text-choice-red", "text-choice-blue", "text-choice-green", "text-choice-yellow"];
const CHOICE_BG_LIGHT_CLASSES = ["bg-choice-red/[0.08]", "bg-choice-blue/[0.08]", "bg-choice-green/[0.08]", "bg-choice-yellow/[0.08]"];
const CHOICE_LABELS = ["A", "B", "C", "D"];

type QuestionEditorProps = { quiz: Quiz; onUpdate: () => void };

function QuestionEditor({ quiz, onUpdate }: QuestionEditorProps) {
  const [text, setText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctChoice, setCorrectChoice] = useState(1);
  const [timeLimit, setTimeLimit] = useState(20);
  const [isAdding, setIsAdding] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // コンポーネントアンマウント時に ObjectURL を解放
  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 旧プレビューを解放
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setMediaUrl(null);
    setUploadError(null);
    setIsUploading(true);

    try {
      const result = await uploadMedia(file);
      setMediaUrl(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setMediaUrl(null);
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveImage() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setMediaUrl(null);
    setUploadError(null);
    setIsUploading(false);
    setFileInputKey((k) => k + 1);
  }

  function resetForm() {
    setText("");
    setChoices(["", "", "", ""]);
    setCorrectChoice(1);
    setTimeLimit(20);
    handleRemoveImage();
    setEditingQuestion(null);
  }

  function handleStartEdit(q: Question) {
    setText(q.text);
    setChoices([q.choice1, q.choice2, q.choice3, q.choice4]);
    setCorrectChoice(q.correct_choice);
    setTimeLimit(q.time_limit_seconds);
    if (q.media_url) {
      setPreviewUrl(q.media_url);
      setMediaUrl(q.media_url);
    } else {
      handleRemoveImage();
    }
    setEditingQuestion(q);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSave() {
    if (!editingQuestion) return;
    if (!text.trim() || choices.some((c) => !c.trim())) return;
    if (isUploading || isAdding) return;
    setIsAdding(true);
    try {
      await updateQuestion(editingQuestion.id, {
        key: quiz.host_secret,
        text: text.trim(),
        choice1: choices[0].trim(),
        choice2: choices[1].trim(),
        choice3: choices[2].trim(),
        choice4: choices[3].trim(),
        correctChoice,
        timeLimitSeconds: timeLimit,
        mediaType: mediaUrl ? "image" : "none",
        mediaUrl: mediaUrl,
      });
      resetForm();
      onUpdate();
    } catch {
      setAddError("問題の更新に失敗しました");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleReorder(questionIndex: number, direction: "up" | "down") {
    const questions = quiz.questions;
    if (!questions) return;
    const targetIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const ids = questions.map((q) => q.id);
    [ids[questionIndex], ids[targetIndex]] = [ids[targetIndex], ids[questionIndex]];
    try {
      await reorderQuestions(quiz.id, quiz.host_secret, ids);
      onUpdate();
    } catch {
      setAddError("問題の並べ替えに失敗しました");
    }
  }

  async function handleAdd() {
    if (!text.trim() || choices.some((c) => !c.trim())) return;
    if (isUploading || isAdding) return;
    setIsAdding(true);
    try {
      await addQuestion({
        quizId: quiz.id,
        key: quiz.host_secret,
        text: text.trim(),
        choice1: choices[0].trim(),
        choice2: choices[1].trim(),
        choice3: choices[2].trim(),
        choice4: choices[3].trim(),
        correctChoice,
        timeLimitSeconds: timeLimit,
        mediaType: mediaUrl ? "image" : undefined,
        mediaUrl: mediaUrl ?? undefined,
      });
      resetForm();
      onUpdate();
    } catch {
      setAddError("問題の追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleDelete(questionId: number) {
    setPendingDeleteId(null);
    try {
      await deleteQuestion(questionId, quiz.host_secret);
      onUpdate();
    } catch {
      setAddError("問題の削除に失敗しました");
    }
  }

  const canAdd = text.trim() && choices.every((c) => c.trim());

  return (
    <div>
      {/* 既存の問題リスト */}
      {(quiz.questions?.length ?? 0) > 0 && (
        <div className="mb-6">
          {quiz.questions!.map((q: Question, i: number) => (
            <div
              key={q.id}
              className="p-4 mb-2 rounded-lg bg-gray-50 border border-gray-100"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    {q.media_url && q.media_type === "image" && (
                      <img
                        src={q.media_url}
                        alt="問題画像"
                        width={64}
                        height={48}
                        loading="lazy"
                        className="w-16 h-12 object-cover rounded shrink-0"
                      />
                    )}
                    <div className="font-semibold text-base text-gray-800">
                      Q{i + 1}. {q.text}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, ci) => {
                      const isCorrect = ci + 1 === q.correct_choice;
                      return (
                        <div
                          key={ci}
                          className={[
                            "px-2.5 py-1 rounded text-sm",
                            isCorrect ? `${CHOICE_BG_CLASSES[ci]} text-white font-semibold` : "bg-gray-100 text-gray-600",
                          ].join(" ")}
                        >
                          {CHOICE_LABELS[ci]}. {c}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">
                    制限時間: {q.time_limit_seconds}秒 ・ 配点: {q.points}点
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 ml-3 shrink-0">
                  {/* 並べ替えボタン */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleReorder(i, "up")}
                      disabled={i === 0}
                      aria-label="上へ移動"
                      className={[
                        "px-2 py-1 rounded text-sm transition-colors duration-150 min-h-[32px]",
                        i === 0 ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-gray-100 cursor-pointer",
                      ].join(" ")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(i, "down")}
                      disabled={i === (quiz.questions?.length ?? 0) - 1}
                      aria-label="下へ移動"
                      className={[
                        "px-2 py-1 rounded text-sm transition-colors duration-150 min-h-[32px]",
                        i === (quiz.questions?.length ?? 0) - 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-gray-100 cursor-pointer",
                      ].join(" ")}
                    >
                      ↓
                    </button>
                  </div>
                  {/* 編集・削除ボタン */}
                  {pendingDeleteId === q.id ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="px-3 py-1.5 rounded text-sm text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 min-h-[44px]"
                      >
                        確認
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="px-3 py-1.5 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 min-h-[44px]"
                      >
                        戻る
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(q)}
                        className="px-3 py-1.5 rounded text-sm text-blue-600 border border-blue-600 hover:bg-blue-50 transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(q.id)}
                        className="px-3 py-1.5 rounded text-sm text-red-600 border border-red-600 hover:bg-red-50 transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規問題フォーム / 編集フォーム */}
      <div ref={formRef} className={[
        "p-5 rounded-lg border-2",
        editingQuestion ? "bg-blue-50/50 border-blue-300" : "bg-gray-50 border-dashed border-gray-300",
      ].join(" ")}>
        <h3 className="text-base font-semibold mb-4 text-gray-600">
          {editingQuestion
            ? `問題を編集中（Q${(quiz.questions?.findIndex((q) => q.id === editingQuestion.id) ?? 0) + 1}）`
            : "+ 新しい問題を追加"}
        </h3>

        {addError !== null ? (
          <button
            type="button"
            onClick={() => setAddError(null)}
            className="w-full mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100 transition-colors duration-150"
          >
            {addError}（タップで閉じる）
          </button>
        ) : null}

        {/* 問題文 */}
        <div className="mb-4">
          <label htmlFor="question-text" className="block text-sm text-gray-600 mb-1 font-semibold">問題文</label>
          <input
            id="question-text"
            type="text"
            name="question-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例：新郎の出身地はどこ？…"
            className="w-full px-3.5 py-2.5 rounded-lg border-2 border-gray-200 text-base focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-[border-color,box-shadow] duration-200"
          />
        </div>

        {/* 画像アップロード */}
        <div className="mb-4">
          <span className="block text-sm text-gray-600 mb-2 font-semibold">問題画像（任意）</span>
          <input
            key={fileInputKey}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp"
            className="sr-only"
            id="question-image-input"
            onChange={handleFileSelect}
          />
          {!previewUrl ? (
            <label
              htmlFor="question-image-input"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:border-accent hover:text-accent transition-colors duration-150"
            >
              画像を選択
            </label>
          ) : (
            <div className="flex items-start gap-3">
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="プレビュー"
                  width={120}
                  height={80}
                  className="w-30 h-20 object-cover rounded-lg border border-gray-200"
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <span className="text-white text-xs font-semibold">アップロード中…</span>
                  </div>
                )}
                {!isUploading && mediaUrl && (
                  <div className="absolute top-1 right-1 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="px-3 py-1 rounded text-sm text-red-600 border border-red-300 hover:bg-red-50 transition-colors duration-150 min-h-[32px]"
                >
                  削除
                </button>
                {!isUploading && !uploadError && (
                  <label
                    htmlFor="question-image-input"
                    className="px-3 py-1 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors duration-150 cursor-pointer text-center"
                  >
                    変更
                  </label>
                )}
              </div>
            </div>
          )}
          {uploadError && (
            <p role="alert" className="mt-1.5 text-sm text-red-600">
              {uploadError}
            </p>
          )}
        </div>

        {/* 選択肢 */}
        <div className="mb-4">
          <span className="block text-sm text-gray-600 mb-2 font-semibold">
            選択肢（正解をクリックして選択）
          </span>
          <div className="grid grid-cols-2 gap-2">
            {choices.map((c, i) => {
              const isSelected = correctChoice === i + 1;
              return (
                <div
                  key={i}
                  className={[
                    "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-[border-color,background-color] duration-150",
                    isSelected ? `${CHOICE_BORDER_CLASSES[i]} ${CHOICE_BG_LIGHT_CLASSES[i]}` : "border-gray-300 bg-white",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => setCorrectChoice(i + 1)}
                    aria-label={`選択肢${CHOICE_LABELS[i]}を正解に設定`}
                    aria-pressed={isSelected}
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 min-h-[28px]",
                      isSelected ? CHOICE_BG_CLASSES[i] : "bg-gray-300",
                    ].join(" ")}
                  >
                    {CHOICE_LABELS[i]}
                  </button>
                  <input
                    type="text"
                    name={`choice-${CHOICE_LABELS[i].toLowerCase()}`}
                    value={c}
                    onChange={(e) => {
                      const next = [...choices];
                      next[i] = e.target.value;
                      setChoices(next);
                    }}
                    placeholder={`選択肢${CHOICE_LABELS[i]}…`}
                    aria-label={`選択肢${CHOICE_LABELS[i]}のテキスト`}
                    className="flex-1 bg-transparent border-none text-sm py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
                  />
                  {isSelected && (
                    <span aria-hidden="true" className={`text-xs font-bold shrink-0 ${CHOICE_TEXT_CLASSES[i]}`}>正解</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 制限時間 */}
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <span className="text-sm text-gray-600 font-semibold">制限時間:</span>
          <div className="flex flex-wrap gap-1.5">
            {[10, 15, 20, 30, 45, 60].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeLimit(t)}
                className={[
                  "px-3.5 py-2 rounded-full text-sm border transition-colors duration-150 min-h-[44px]",
                  timeLimit === t
                    ? "bg-accent text-white border-accent"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400",
                ].join(" ")}
              >
                {t}秒
              </button>
            ))}
          </div>
        </div>

        {/* 追加/保存ボタン */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={editingQuestion ? handleSave : handleAdd}
            disabled={!canAdd || isAdding || isUploading}
            className={[
              "flex-1 py-3.5 rounded-lg text-base font-bold text-white transition-colors duration-150 min-h-[44px]",
              canAdd && !isAdding && !isUploading
                ? "bg-[#1e88e5] hover:opacity-90 cursor-pointer"
                : "bg-gray-300 cursor-not-allowed",
            ].join(" ")}
          >
            {isAdding
              ? (editingQuestion ? "保存中…" : "追加中…")
              : isUploading
                ? "アップロード中…"
                : (editingQuestion ? "変更を保存" : "この問題を追加")}
          </button>
          {editingQuestion && (
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3.5 rounded-lg text-base font-bold text-gray-600 border-2 border-gray-300 hover:bg-gray-100 transition-colors duration-150 min-h-[44px]"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
