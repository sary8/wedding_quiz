import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes, addQuestion, deleteQuestion } from "../../services/api";
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
      // 作成直後に選択状態にする
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
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* ヘッダー */}
      <div style={{ background: "linear-gradient(135deg, #e91e63, #ff5722)", padding: "24px 0", marginBottom: 32 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <h1 style={{ fontSize: 28, color: "#fff", margin: 0, fontWeight: 800 }}>Wedding Quiz</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", margin: "4px 0 0", fontSize: 14 }}>問題管理・セットアップ</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px" }}>
        {error && (
          <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "#ffebee", color: "#c62828", fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* ステップ表示 */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
          <StepBadge num={1} label="クイズ作成" active={!selectedQuiz} />
          <StepBadge num={2} label="問題追加" active={!!selectedQuiz} />
          <StepBadge num={3} label="ロビー開始" active={false} />
        </div>

        {/* クイズ作成セクション */}
        <section style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, color: "#333" }}>新しいクイズを作成</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：太郎＆花子 結婚式クイズ…"
              aria-label="クイズのタイトル"
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 8,
                border: "2px solid #e0e0e0",
                fontSize: 16,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#e91e63")}
              onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
              onKeyDown={(e) => e.key === "Enter" && handleCreateQuiz()}
            />
            <button
              onClick={handleCreateQuiz}
              disabled={isLoading || !title.trim()}
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                background: title.trim() ? "#e91e63" : "#e0e0e0",
                color: "#fff",
                fontSize: 16,
                fontWeight: "bold",
                cursor: title.trim() ? "pointer" : "default",
                border: "none",
                whiteSpace: "nowrap",
              }}
            >
              {isLoading ? "作成中..." : "作成"}
            </button>
          </div>
        </section>

        {/* 既存クイズ一覧 */}
        {quizList.length > 0 && (
          <section style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: 18, marginBottom: 16, color: "#333" }}>作成済みクイズ</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quizList.map((q) => {
                const isSelected = selectedQuiz?.id === q.id;
                const hasKey = !!getHostSecret(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => handleSelectQuiz(q)}
                    disabled={!hasKey}
                    aria-pressed={isSelected}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: isSelected ? "2px solid #e91e63" : "2px solid transparent",
                      background: isSelected ? "#fce4ec" : "#fafafa",
                      opacity: hasKey ? 1 : 0.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "border-color 0.15s, background 0.15s",
                      width: "100%",
                      textAlign: "left",
                      cursor: hasKey ? "pointer" : "not-allowed",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: "#333" }}>{q.title}</div>
                      <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                        ルーム: {q.room_code} ・ {statusLabel(q.status)}
                      </div>
                    </div>
                    {isSelected && (
                      <span style={{ background: "#e91e63", color: "#fff", padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
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
          <section style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, margin: 0, color: "#333" }}>
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
            onClick={handleStartLobby}
            style={{
              width: "100%",
              padding: 18,
              borderRadius: 12,
              background: "linear-gradient(135deg, #e91e63, #ff5722)",
              color: "#fff",
              fontSize: 20,
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(233,30,99,0.4)",
            }}
          >
            ロビーを開く（参加者受付開始）
          </button>
        )}

        {selectedQuiz && (selectedQuiz.questions?.length ?? 0) === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "#888", fontSize: 14 }}>
            問題を1つ以上追加するとロビーを開始できます
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ num, label, active }: { num: number; label: string; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: active ? "#e91e63" : "#e0e0e0",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {num}
      </div>
      <span style={{ fontSize: 14, color: active ? "#333" : "#999", fontWeight: active ? 600 : 400 }}>{label}</span>
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

  const choiceColors = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];
  const choiceLabels = ["A", "B", "C", "D"];

  async function handleAdd() {
    if (!text.trim() || choices.some((c) => !c.trim())) return;
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
      });
      setText("");
      setChoices(["", "", "", ""]);
      setCorrectChoice(1);
      onUpdate();
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(questionId: number) {
    if (!confirm("この問題を削除しますか？")) return;
    await deleteQuestion(questionId, quiz.host_secret);
    onUpdate();
  }

  const canAdd = text.trim() && choices.every((c) => c.trim());

  return (
    <div>
      {/* 既存の問題リスト */}
      {(quiz.questions?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 24 }}>
          {quiz.questions!.map((q: Question, i: number) => (
            <div
              key={q.id}
              style={{
                padding: 16,
                marginBottom: 8,
                borderRadius: 8,
                background: "#fafafa",
                border: "1px solid #eee",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#333", marginBottom: 8 }}>
                    Q{i + 1}. {q.text}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, ci) => (
                      <div
                        key={ci}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 13,
                          background: ci + 1 === q.correct_choice ? choiceColors[ci] : "#f0f0f0",
                          color: ci + 1 === q.correct_choice ? "#fff" : "#555",
                          fontWeight: ci + 1 === q.correct_choice ? 600 : 400,
                        }}
                      >
                        {choiceLabels[ci]}. {c}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
                    制限時間: {q.time_limit_seconds}秒 ・ 配点: {q.points}点
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(q.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: "transparent",
                    color: "#e53935",
                    fontSize: 13,
                    border: "1px solid #e53935",
                    cursor: "pointer",
                    marginLeft: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規問題フォーム */}
      <div style={{ padding: 20, borderRadius: 8, background: "#f5f5f5", border: "2px dashed #ddd" }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: "#555" }}>
          + 新しい問題を追加
        </h3>

        {/* 問題文 */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="question-text" style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 4, fontWeight: 600 }}>問題文</label>
          <input
            id="question-text"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例：新郎の出身地はどこ？…"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "2px solid #e0e0e0",
              fontSize: 16,
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#e91e63")}
            onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
          />
        </div>

        {/* 選択肢 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 8, fontWeight: 600 }}>
            選択肢（正解をクリックして選択）
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {choices.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `2px solid ${correctChoice === i + 1 ? choiceColors[i] : "#e0e0e0"}`,
                  background: correctChoice === i + 1 ? `${choiceColors[i]}15` : "#fff",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <button
                  type="button"
                  onClick={() => setCorrectChoice(i + 1)}
                  aria-label={`選択肢${choiceLabels[i]}を正解に設定`}
                  aria-pressed={correctChoice === i + 1}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: correctChoice === i + 1 ? choiceColors[i] : "#e0e0e0",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {choiceLabels[i]}
                </button>
                <input
                  type="text"
                  value={c}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  placeholder={`選択肢${choiceLabels[i]}…`}
                  aria-label={`選択肢${choiceLabels[i]}のテキスト`}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    border: "none",
                    background: "transparent",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
                {correctChoice === i + 1 && (
                  <span aria-hidden="true" style={{ fontSize: 12, color: choiceColors[i], fontWeight: 700, flexShrink: 0 }}>正解</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 制限時間 */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: "#666", fontWeight: 600 }}>制限時間:</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[10, 15, 20, 30, 45, 60].map((t) => (
              <button
                key={t}
                onClick={() => setTimeLimit(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 16,
                  background: timeLimit === t ? "#e91e63" : "#fff",
                  color: timeLimit === t ? "#fff" : "#666",
                  fontSize: 13,
                  border: `1px solid ${timeLimit === t ? "#e91e63" : "#ddd"}`,
                  cursor: "pointer",
                }}
              >
                {t}秒
              </button>
            ))}
          </div>
        </div>

        {/* 追加ボタン */}
        <button
          onClick={handleAdd}
          disabled={!canAdd || isAdding}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            background: canAdd ? "#1e88e5" : "#e0e0e0",
            color: "#fff",
            fontSize: 16,
            fontWeight: "bold",
            border: "none",
            cursor: canAdd ? "pointer" : "default",
          }}
        >
          {isAdding ? "追加中..." : "この問題を追加"}
        </button>
      </div>
    </div>
  );
}
