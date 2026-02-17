import type { FinalResultData } from "../../types";

type Props = {
  data: FinalResultData | null;
  participantId: number | null;
};

export function ParticipantFinalPage({ data, participantId }: Props) {
  if (!data || !participantId) return null;

  const myResult = data.rankings.find((r) => r.participantId === participantId);
  if (!myResult) return null;

  const accuracyPercent = myResult.totalQuestions > 0
    ? Math.round((myResult.correctCount / myResult.totalQuestions) * 100)
    : 0;

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: myResult.rank <= 3
        ? "linear-gradient(135deg, #ffd700, #ff8c00)"
        : "linear-gradient(135deg, #667eea, #764ba2)",
      color: "#fff",
      padding: 24,
    }}>
      <h2 style={{ fontSize: 24, marginBottom: 8, fontWeight: "normal" }}>あなたの最終順位</h2>
      <p style={{ fontSize: 80, fontWeight: "bold", marginBottom: 24 }}>
        第{myResult.rank}位
      </p>

      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 16, padding: 24, textAlign: "center", minWidth: 280 }}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>ニックネーム: {myResult.nickname}</p>
        <p style={{ fontSize: 32, fontWeight: "bold", marginBottom: 16 }}>
          {myResult.totalScore.toLocaleString()}点
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <p>正答率: {accuracyPercent}% ({myResult.correctCount}/{myResult.totalQuestions}問)</p>
          <p>平均回答速度: {(myResult.averageResponseTimeMs / 1000).toFixed(2)}秒</p>
          <p>最速回答: {(myResult.fastestResponseTimeMs / 1000).toFixed(3)}秒</p>
        </div>
      </div>

      <p style={{ fontSize: 14, marginTop: 32, opacity: 0.7 }}>ご参加ありがとうございました！</p>
    </div>
  );
}
