import { QRCodeSVG } from "qrcode.react";
import type { ParticipantInfo } from "../../types";

type Props = {
  roomCode: string;
  participants: ParticipantInfo[];
  onStartGame: () => void;
};

export function LobbyPage({ roomCode, participants, onStartGame }: Props) {
  const joinUrl = `${window.location.origin}/play/${roomCode}`;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", color: "#fff", padding: 24 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Wedding Quiz</h1>
      <p style={{ fontSize: 18, marginBottom: 32, opacity: 0.8 }}>スマホで参加しよう！</p>

      <div style={{ display: "flex", gap: 48, alignItems: "center", marginBottom: 32 }}>
        {/* QRコード */}
        <div style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
          <QRCodeSVG value={joinUrl} size={200} />
        </div>

        {/* ルームコード */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>ルームコード</p>
          <p style={{ fontSize: 64, fontWeight: "bold", letterSpacing: 8 }}>{roomCode}</p>
        </div>
      </div>

      {/* 参加者一覧 */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <p style={{ fontSize: 20, marginBottom: 16 }}>参加者: {participants.length}人</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: 800 }}>
          {participants.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.2)", borderRadius: 24, padding: "6px 16px" }}>
              {p.selfieUrl ? (
                <img src={p.selfieUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {p.nickname?.[0] || "?"}
                </div>
              )}
              <span style={{ fontSize: 14 }}>{p.nickname}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onStartGame}
        disabled={participants.length === 0}
        style={{
          padding: "16px 48px",
          borderRadius: 16,
          background: participants.length > 0 ? "#e91e63" : "rgba(255,255,255,0.2)",
          color: "#fff",
          fontSize: 24,
          fontWeight: "bold",
        }}
      >
        ゲーム開始
      </button>
    </div>
  );
}
