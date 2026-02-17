import { motion, AnimatePresence } from "framer-motion";
import type { RankingData } from "../../types";

type Props = {
  data: RankingData | null;
  onNextQuestion: () => void;
  onEndGame: () => void;
};

export function RankingPage({ data, onNextQuestion, onEndGame }: Props) {
  if (!data) return null;

  const top10 = data.rankings.slice(0, 10);
  const maxScore = top10.reduce((max, r) => Math.max(max, r.totalScore), 1);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #1a1a2e, #16213e)", color: "#fff", padding: 24 }}>
      <h2 style={{ fontSize: 32, textAlign: "center", marginBottom: 24 }}>ランキング</h2>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <AnimatePresence>
          {top10.map((entry) => {
            const barWidth = (entry.totalScore / maxScore) * 100;
            const rankChange = entry.previousRank - entry.rank;
            const changeText = rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : "";
            const changeColor = rankChange > 0 ? "#4caf50" : rankChange < 0 ? "#ef5350" : "transparent";

            return (
              <motion.div
                key={entry.participantId}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 80, damping: 15, duration: 1.5 }}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                {/* 順位 */}
                <span style={{ width: 40, fontSize: 24, fontWeight: "bold", textAlign: "center" }}>
                  {entry.rank}
                </span>

                {/* アイコン */}
                {entry.selfieUrl ? (
                  <img src={entry.selfieUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff" }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#667eea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: "bold" }}>
                    {entry.nickname?.[0] || "?"}
                  </div>
                )}

                {/* ニックネーム */}
                <span style={{ width: 100, fontSize: 16, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.nickname}
                </span>

                {/* スコアバー */}
                <div style={{ flex: 1, height: 36, background: "rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 15 }}
                    style={{ height: "100%", background: "linear-gradient(90deg, #667eea, #764ba2)", borderRadius: 8 }}
                  />
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: "bold" }}>
                    {entry.totalScore.toLocaleString()}点
                  </span>
                </div>

                {/* 順位変動 */}
                <span style={{ width: 40, fontSize: 14, fontWeight: "bold", color: changeColor, textAlign: "center" }}>
                  {changeText}
                </span>

                {/* 回答速度 */}
                <span style={{ width: 70, fontSize: 12, color: "#aaa", textAlign: "right" }}>
                  {entry.lastResponseTimeMs != null
                    ? `${(entry.lastResponseTimeMs / 1000).toFixed(3)}秒`
                    : "---"}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 24 }}>
        <button
          onClick={onNextQuestion}
          style={{ padding: "16px 32px", borderRadius: 12, background: "#1e88e5", color: "#fff", fontSize: 18, fontWeight: "bold" }}
        >
          次の問題
        </button>
        <button
          onClick={onEndGame}
          style={{ padding: "16px 32px", borderRadius: 12, background: "#e91e63", color: "#fff", fontSize: 18, fontWeight: "bold" }}
        >
          最終結果発表
        </button>
      </div>
    </div>
  );
}
