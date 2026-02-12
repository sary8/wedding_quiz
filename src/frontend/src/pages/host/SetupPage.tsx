import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createQuiz, getQuiz, listQuizzes, addQuestion, deleteQuestion } from "../../services/api";
import type { Quiz, Question } from "../../types";

export function SetupPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function loadQuizzes() {
    const data = await listQuizzes();
    setQuizzes(data);
  }

  async function handleCreateQuiz() {
    if (!title.trim()) return;
    setIsLoading(true);
    try {
      const quiz = await createQuiz(title.trim());
      setTitle("");
      await loadQuizzes();
      await handleSelectQuiz(quiz.id, quiz.host_secret);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectQuiz(id: number, key: string) {
    const quiz = await getQuiz(id, key);
    setSelectedQuiz(quiz);
  }

  async function handleStartLobby() {
    if (!selectedQuiz) return;
    navigate(`/host/${selectedQuiz.room_code}?key=${selectedQuiz.host_secret}`);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Wedding Quiz - 問題管理</h1>

      {/* クイズ作成 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新しいクイズのタイトル"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
          onKeyDown={(e) => e.key === "Enter" && handleCreateQuiz()}
        />
        <button
          onClick={handleCreateQuiz}
          disabled={isLoading || !title.trim()}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            background: "#e91e63",
            color: "#fff",
            fontSize: 16,
            fontWeight: "bold",
            opacity: isLoading || !title.trim() ? 0.5 : 1,
          }}
        >
          作成
        </button>
      </div>

      {/* クイズ一覧 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>クイズ一覧</h2>
        {quizzes.length === 0 && <p style={{ color: "#888" }}>クイズがありません</p>}
        {quizzes.map((q) => (
          <div
            key={q.id}
            onClick={() => handleSelectQuiz(q.id, q.host_secret)}
            style={{
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
              border: selectedQuiz?.id === q.id ? "2px solid #e91e63" : "1px solid #ddd",
              background: selectedQuiz?.id === q.id ? "#fce4ec" : "#fff",
              cursor: "pointer",
            }}
          >
            <strong>{q.title}</strong>
            <span style={{ marginLeft: 12, color: "#888", fontSize: 14 }}>
              コード: {q.room_code} / {q.status}
            </span>
          </div>
        ))}
      </div>

      {/* 問題編集 */}
      {selectedQuiz && (
        <QuestionEditor quiz={selectedQuiz} onUpdate={() => handleSelectQuiz(selectedQuiz.id, selectedQuiz.host_secret)} />
      )}

      {/* ロビー開始ボタン */}
      {selectedQuiz && (
        <button
          onClick={handleStartLobby}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 12,
            background: "linear-gradient(135deg, #e91e63, #ff5722)",
            color: "#fff",
            fontSize: 20,
            fontWeight: "bold",
            marginTop: 24,
          }}
        >
          ロビーを開く
        </button>
      )}
    </div>
  );
}

type QuestionEditorProps = { quiz: Quiz; onUpdate: () => void };

function QuestionEditor({ quiz, onUpdate }: QuestionEditorProps) {
  const [text, setText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctChoice, setCorrectChoice] = useState(1);
  const [timeLimit, setTimeLimit] = useState(20);

  async function handleAdd() {
    if (!text.trim() || choices.some((c) => !c.trim())) return;
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
  }

  async function handleDelete(questionId: number) {
    await deleteQuestion(questionId, quiz.host_secret);
    onUpdate();
  }

  const choiceColors = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>
        問題一覧（{quiz.questions?.length ?? 0}問）
      </h2>

      {/* 既存の問題リスト */}
      {quiz.questions?.map((q: Question, i: number) => (
        <div key={q.id} style={{ padding: 12, marginBottom: 8, borderRadius: 8, background: "#fff", border: "1px solid #ddd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              <strong>Q{i + 1}.</strong> {q.text}
            </span>
            <button
              onClick={() => handleDelete(q.id)}
              style={{ padding: "4px 12px", borderRadius: 4, background: "#ef5350", color: "#fff", fontSize: 12 }}
            >
              削除
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {[q.choice1, q.choice2, q.choice3, q.choice4].map((c, ci) => (
              <span
                key={ci}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  background: ci + 1 === q.correct_choice ? choiceColors[ci] : "#eee",
                  color: ci + 1 === q.correct_choice ? "#fff" : "#333",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* 新規問題フォーム */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "#fff", border: "1px solid #ddd" }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>問題を追加</h3>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="問題文"
          style={{ width: "100%", padding: "8px 12px", marginBottom: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {choices.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="radio"
                name="correct"
                checked={correctChoice === i + 1}
                onChange={() => setCorrectChoice(i + 1)}
              />
              <input
                type="text"
                value={c}
                onChange={(e) => {
                  const next = [...choices];
                  next[i] = e.target.value;
                  setChoices(next);
                }}
                placeholder={`選択肢${i + 1}`}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `2px solid ${choiceColors[i]}`,
                  fontSize: 14,
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <label>制限時間:</label>
          <select value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} style={{ padding: 4, borderRadius: 4 }}>
            {[10, 15, 20, 30, 45, 60].map((t) => (
              <option key={t} value={t}>{t}秒</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          style={{ padding: "8px 24px", borderRadius: 8, background: "#1e88e5", color: "#fff", fontSize: 14, fontWeight: "bold" }}
        >
          追加
        </button>
      </div>
    </div>
  );
}
