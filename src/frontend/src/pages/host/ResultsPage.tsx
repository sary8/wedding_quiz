import type { QuestionResultData } from "../../types";

type Props = {
  result: QuestionResultData | null;
  onShowRanking: () => void;
  onNextQuestion: () => void;
};

const CHOICE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#f9a825"];

export function ResultsPage({ result, onShowRanking, onNextQuestion }: Props) {
  if (!result) return null;

  const totalAnswers = result.distribution.reduce((s, n) => s + n, 0);
  const maxCount = Math.max(...result.distribution, 1);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1a2e", color: "#fff", padding: 24 }}>
      <h2 style={{ fontSize: 32, marginBottom: 32 }}>回答結果</h2>

      {/* 回答分布グラフ */}
      <div style={{ width: "100%", maxWidth: 600, marginBottom: 48 }}>
        {result.distribution.map((count, i) => {
          const isCorrect = i + 1 === result.correctChoice;
          const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
          const barWidth = (count / maxCount) * 100;

          return (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: isCorrect ? "bold" : "normal" }}>
                  選択肢{i + 1} {isCorrect && "✓ 正解"}
                </span>
                <span>{count}人 ({percentage}%)</span>
              </div>
              <div style={{ height: 40, background: "rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    background: isCorrect ? CHOICE_COLORS[i] : `${CHOICE_COLORS[i]}88`,
                    borderRadius: 8,
                    transition: "width 0.8s ease-out",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={onShowRanking}
          style={{ padding: "16px 32px", borderRadius: 12, background: "#e91e63", color: "#fff", fontSize: 18, fontWeight: "bold" }}
        >
          ランキング表示
        </button>
        <button
          onClick={onNextQuestion}
          style={{ padding: "16px 32px", borderRadius: 12, background: "#1e88e5", color: "#fff", fontSize: 18, fontWeight: "bold" }}
        >
          次の問題
        </button>
      </div>
    </div>
  );
}
