import type { QuestionResultData } from "../../types";

type Props = {
  result: QuestionResultData | null;
};

export function ResultPage({ result }: Props) {
  if (!result?.yourAnswer) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1a2e", color: "#fff" }}>
        <p style={{ fontSize: 24 }}>未回答</p>
        <p style={{ fontSize: 16, color: "#aaa", marginTop: 8 }}>次の問題をお待ちください</p>
      </div>
    );
  }

  const { yourAnswer } = result;
  const isCorrect = yourAnswer.isCorrect;

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: isCorrect ? "linear-gradient(135deg, #43a047, #66bb6a)" : "linear-gradient(135deg, #e53935, #ef5350)",
      color: "#fff",
      padding: 24,
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>
        {isCorrect ? "⭕" : "❌"}
      </div>
      <p style={{ fontSize: 32, fontWeight: "bold", marginBottom: 24 }}>
        {isCorrect ? "正解！" : "不正解..."}
      </p>

      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 16, padding: 24, textAlign: "center", minWidth: 240 }}>
        <p style={{ fontSize: 40, fontWeight: "bold", marginBottom: 12 }}>
          +{yourAnswer.scoreAwarded}点
        </p>
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          回答速度: {(yourAnswer.responseTimeMs / 1000).toFixed(3)}秒
        </p>
        <p style={{ fontSize: 16, marginBottom: 8 }}>
          累計スコア: {yourAnswer.totalScore.toLocaleString()}点
        </p>
        <p style={{ fontSize: 20, fontWeight: "bold" }}>
          現在 第{yourAnswer.currentRank}位
        </p>
      </div>
    </div>
  );
}
