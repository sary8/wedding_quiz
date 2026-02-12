import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function JoinPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  function handleJoin() {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;
    navigate(`/play/${code}`);
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", padding: 24 }}>
      <h1 style={{ fontSize: 32, color: "#fff", marginBottom: 8 }}>Wedding Quiz</h1>
      <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: 32 }}>ルームコードを入力して参加</p>

      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="ルームコード"
        maxLength={6}
        style={{
          width: 240,
          padding: "16px 24px",
          borderRadius: 16,
          border: "none",
          fontSize: 32,
          textAlign: "center",
          letterSpacing: 8,
          fontWeight: "bold",
          marginBottom: 16,
        }}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
      />

      <button
        onClick={handleJoin}
        disabled={roomCode.length !== 6}
        style={{
          width: 240,
          padding: 16,
          borderRadius: 16,
          background: roomCode.length === 6 ? "#e91e63" : "rgba(255,255,255,0.2)",
          color: "#fff",
          fontSize: 20,
          fontWeight: "bold",
        }}
      >
        参加する
      </button>
    </div>
  );
}
