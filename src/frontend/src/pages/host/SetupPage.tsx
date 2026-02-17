import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes, addQuestion, deleteQuestion, uploadMedia } from "../../services/api";
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

  function handleStartLobby() {
    if (!selectedQuiz) return;
    navigate(`/host/${selectedQuiz.room_code}?key=${selectedQuiz.host_secret}&quizId=${selectedQuiz.id}`);
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
              <h2 className="text-lg font-semibold m-0 text-gray-800">
                「{selectedQuiz.title}」の問題（{selectedQuiz.questions?.length ?? 0}問）
              </h2>
            </div>
            <QuestionEditor
              quiz={selectedQuiz}
              onUpdate={async () => {
                const key = getHostSecret(selectedQuiz.id);
                if (key) {
                  const updated = await getQuiz(selectedQuiz.id, key);
                  setSelectedQuiz(updated);
                }
              }}
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

  const choiceColors = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];
  const choiceLabels = ["A", "B", "C", "D"];

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
      setText("");
      setChoices(["", "", "", ""]);
      setCorrectChoice(1);
      handleRemoveImage();
      onUpdate();
    } catch {
      alert("問題の追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(questionId: number) {
    if (!confirm("この問題を削除しますか？")) return;
    try {
      await deleteQuestion(questionId, quiz.host_secret);
      onUpdate();
    } catch {
      alert("問題の削除に失敗しました");
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
                        alt=""
                        width={64}
                        height={48}
                        className="w-16 h-12 object-cover rounded shrink-0"
                      />
                    )}
                    <div className="font-semibold text-base text-gray-800">
                      Q{i + 1}. {q.text}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, ci) => (
                      <div
                        key={ci}
                        className="px-2.5 py-1 rounded text-sm"
                        style={{
                          background: ci + 1 === q.correct_choice ? choiceColors[ci] : "#f0f0f0",
                          color: ci + 1 === q.correct_choice ? "#fff" : "#555",
                          fontWeight: ci + 1 === q.correct_choice ? 600 : 400,
                        }}
                      >
                        {choiceLabels[ci]}. {c}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">
                    制限時間: {q.time_limit_seconds}秒 ・ 配点: {q.points}点
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  className="px-3.5 py-1.5 rounded text-sm text-red-600 border border-red-600 hover:bg-red-50 transition-colors duration-150 cursor-pointer ml-3 whitespace-nowrap min-h-[44px]"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規問題フォーム */}
      <div className="p-5 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300">
        <h3 className="text-base font-semibold mb-4 text-gray-600">+ 新しい問題を追加</h3>

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
            {choices.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-[border-color,background-color] duration-150"
                style={{
                  borderColor: correctChoice === i + 1 ? choiceColors[i] : "#e0e0e0",
                  background: correctChoice === i + 1 ? `${choiceColors[i]}15` : "#fff",
                }}
              >
                <button
                  type="button"
                  onClick={() => setCorrectChoice(i + 1)}
                  aria-label={`選択肢${choiceLabels[i]}を正解に設定`}
                  aria-pressed={correctChoice === i + 1}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 min-h-[28px]"
                  style={{ background: correctChoice === i + 1 ? choiceColors[i] : "#e0e0e0" }}
                >
                  {choiceLabels[i]}
                </button>
                <input
                  type="text"
                  name={`choice-${choiceLabels[i].toLowerCase()}`}
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={`選択肢${choiceLabels[i]}…`}
                  aria-label={`選択肢${choiceLabels[i]}のテキスト`}
                  className="flex-1 bg-transparent border-none text-sm py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
                />
                {correctChoice === i + 1 && (
                  <span aria-hidden="true" className="text-xs font-bold shrink-0" style={{ color: choiceColors[i] }}>正解</span>
                )}
              </div>
            ))}
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
                  "px-3.5 py-1.5 rounded-full text-sm border transition-colors duration-150 min-h-[36px]",
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

        {/* 追加ボタン */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd || isAdding || isUploading}
          className={[
            "w-full py-3.5 rounded-lg text-base font-bold text-white transition-colors duration-150 min-h-[44px]",
            canAdd && !isAdding && !isUploading
              ? "bg-[#1e88e5] hover:opacity-90 cursor-pointer"
              : "bg-gray-300 cursor-not-allowed",
          ].join(" ")}
        >
          {isAdding ? "追加中…" : isUploading ? "アップロード中…" : "この問題を追加"}
        </button>
      </div>
    </div>
  );
}
