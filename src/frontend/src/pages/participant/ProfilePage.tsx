import { useState } from "react";
import { useCamera } from "../../hooks/useCamera";

type Props = {
  onJoin: (nickname: string, selfieData?: string) => void;
};

export function ProfilePage({ onJoin }: Props) {
  const [nickname, setNickname] = useState("");
  const camera = useCamera();

  function handleSubmit() {
    if (!nickname.trim()) return;
    onJoin(nickname.trim(), camera.capturedImage || undefined);
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", padding: 24 }}>
      <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 24 }}>プロフィール設定</h1>

      {/* ニックネーム */}
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
          marginBottom: 20,
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />

      {/* 自撮りエリア */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>自撮り（任意）</p>

        {/* カメラエラー表示 */}
        {camera.error && (
          <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(239,83,80,0.3)", color: "#fff", fontSize: 13, maxWidth: 280 }}>
            {camera.error}
          </div>
        )}

        {camera.capturedImage ? (
          // 撮影済み
          <div>
            <img
              src={camera.capturedImage}
              alt="自撮り"
              style={{ width: 200, height: 200, borderRadius: "50%", objectFit: "cover", border: "4px solid rgba(255,255,255,0.5)" }}
            />
            <div style={{ marginTop: 8 }}>
              <button
                onClick={camera.retake}
                style={{ padding: "6px 16px", borderRadius: 8, background: "rgba(255,255,255,0.3)", color: "#fff", fontSize: 14 }}
              >
                撮り直す
              </button>
            </div>
          </div>
        ) : camera.isActive ? (
          // カメラ起動中
          <div>
            <div style={{ position: "relative", width: 200, height: 200, borderRadius: "50%", overflow: "hidden", margin: "0 auto", border: "4px solid rgba(255,255,255,0.5)" }}>
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: 200, height: 200, objectFit: "cover", transform: "scaleX(-1)" }}
              />
            </div>

            {/* フレーム選択 */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
              {camera.frameOptions.map((frame) => (
                <button
                  key={frame.type}
                  onClick={() => camera.setSelectedFrame(frame.type)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 16,
                    background: camera.selectedFrame === frame.type ? "#e91e63" : "rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                >
                  {frame.label}
                </button>
              ))}
            </div>

            <button
              onClick={camera.capture}
              style={{
                marginTop: 12,
                padding: "10px 32px",
                borderRadius: 24,
                background: "#e91e63",
                color: "#fff",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              撮影
            </button>
          </div>
        ) : (
          // カメラ未起動
          <button
            onClick={camera.startCamera}
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 40 }}>📷</span>
            <span>自撮りを撮る</span>
          </button>
        )}
      </div>

      <canvas ref={camera.canvasRef} style={{ display: "none" }} />

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
