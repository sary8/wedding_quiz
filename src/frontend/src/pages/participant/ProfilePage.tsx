import { useState } from "react";

type Props = {
  onJoin: (nickname: string, selfieData?: string) => void;
};

export function ProfilePage({ onJoin }: Props) {
  const [nickname, setNickname] = useState("");

  function handleSubmit() {
    if (!nickname.trim()) return;
    onJoin(nickname.trim());
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", padding: 24 }}>
      <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 32 }}>プロフィール設定</h1>

      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value.slice(0, 20))}
        placeholder="ニックネーム"
        maxLength={20}
        style={{
          width: 280,
          padding: "14px 20px",
          borderRadius: 12,
          border: "none",
          fontSize: 20,
          textAlign: "center",
          marginBottom: 24,
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />

      {/* TODO: 自撮り撮影機能は後のタスクで追加 */}

      <button
        onClick={handleSubmit}
        disabled={!nickname.trim()}
        style={{
          width: 280,
          padding: 16,
          borderRadius: 12,
          background: nickname.trim() ? "#e91e63" : "rgba(255,255,255,0.2)",
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
