import type { QuestionData } from "../../types";

type Props = {
  question: QuestionData | null;
  timeRemaining: number;
  answerCount: number;
  totalParticipants: number;
  onCloseQuestion: () => void;
};

const CHOICE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];
const CHOICE_ICONS = ["▲", "◆", "●", "■"];

export function QuestionPage({ question, timeRemaining, answerCount, totalParticipants, onCloseQuestion }: Props) {
  if (!question) return null;

  const isUrgent = timeRemaining <= 5;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#1a1a2e" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", color: "#fff" }}>
        <span style={{ fontSize: 16 }}>
          Q{question.questionIndex + 1} / {question.totalQuestions}
        </span>
        <span style={{
          fontSize: 48,
          fontWeight: "bold",
          color: isUrgent ? "#ef5350" : "#fff",
          transition: "color 0.3s",
        }}>
          {timeRemaining}
        </span>
        <span style={{ fontSize: 16 }}>
          回答: {answerCount} / {totalParticipants}
        </span>
      </div>

      {/* 問題文 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {question.mediaUrl && question.mediaType === "image" && (
          <img src={question.mediaUrl} alt="" style={{ maxWidth: "60%", maxHeight: "40vh", borderRadius: 12, marginBottom: 24, objectFit: "contain" }} />
        )}
        {question.mediaUrl && question.mediaType === "video" && (
          <video src={question.mediaUrl} autoPlay muted style={{ maxWidth: "60%", maxHeight: "40vh", borderRadius: 12, marginBottom: 24 }} />
        )}
        <h2 style={{ fontSize: 36, color: "#fff", textAlign: "center" }}>{question.text}</h2>
      </div>

      {/* 選択肢 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 24px 24px" }}>
        {question.choices.map((choice, i) => (
          <div
            key={i}
            style={{
              padding: "20px 24px",
              borderRadius: 12,
              background: CHOICE_COLORS[i],
              color: "#fff",
              fontSize: 22,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 28 }}>{CHOICE_ICONS[i]}</span>
            {choice}
          </div>
        ))}
      </div>

      {/* 手動締め切りボタン */}
      <div style={{ padding: "0 24px 24px", textAlign: "center" }}>
        <button
          onClick={onCloseQuestion}
          style={{ padding: "8px 24px", borderRadius: 8, background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 14 }}
        >
          回答を締め切る
        </button>
      </div>
    </div>
  );
}
