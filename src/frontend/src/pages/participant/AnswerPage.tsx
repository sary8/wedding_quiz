import { useState } from "react";
import type { QuestionData } from "../../types";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  hasAnswered: boolean;
  onAnswer: (choiceIndex: number) => void;
};

const CHOICE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];
const CHOICE_ICONS = ["▲", "◆", "●", "■"];

export function AnswerPage({ question, timeRemaining, hasAnswered, onAnswer }: Props) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  if (!question) return null;

  if (hasAnswered) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1a2e", color: "#fff" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <p style={{ fontSize: 24 }}>回答済み</p>
        <p style={{ fontSize: 16, color: "#aaa", marginTop: 8 }}>結果をお待ちください...</p>
      </div>
    );
  }

  function handleChoiceClick(choiceIndex: number) {
    if (selectedChoice !== null) return; // 連打防止
    setSelectedChoice(choiceIndex);
    onAnswer(choiceIndex);
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#1a1a2e" }}>
      {/* ヘッダー: 問題番号 + タイマー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", color: "#fff" }}>
        <span style={{ fontSize: 14 }}>Q{question.questionIndex + 1} / {question.totalQuestions}</span>
        <span style={{ fontSize: 32, fontWeight: "bold", color: timeRemaining <= 5 ? "#ef5350" : "#fff" }}>
          {timeRemaining}
        </span>
      </div>

      {/* 問題文 */}
      <div style={{ padding: "8px 16px", color: "#fff", textAlign: "center" }}>
        {question.mediaUrl && question.mediaType === "image" && (
          <img src={question.mediaUrl} alt="" style={{ maxWidth: "80%", maxHeight: "25vh", borderRadius: 8, marginBottom: 8, objectFit: "contain" }} />
        )}
        <p style={{ fontSize: 18, fontWeight: "bold" }}>{question.text}</p>
      </div>

      {/* 4色回答ボタン */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8 }}>
        {question.choices.map((choice, i) => {
          const choiceIndex = i + 1;
          const isSelected = selectedChoice === choiceIndex;

          return (
            <button
              key={i}
              onClick={() => handleChoiceClick(choiceIndex)}
              disabled={selectedChoice !== null}
              style={{
                borderRadius: 12,
                background: isSelected ? `${CHOICE_COLORS[i]}` : CHOICE_COLORS[i],
                color: "#fff",
                fontSize: 18,
                fontWeight: "bold",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 12,
                opacity: selectedChoice !== null && !isSelected ? 0.4 : 1,
                transform: isSelected ? "scale(0.95)" : "scale(1)",
                transition: "opacity 0.2s, transform 0.2s",
              }}
            >
              <span style={{ fontSize: 32 }}>{CHOICE_ICONS[i]}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
