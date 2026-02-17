import { useState } from "react";
import { useCamera } from "../../hooks/useCamera";

type Props = {
  onJoin: (nickname: string, selfieData?: string) => void;
};

export function ProfilePage({ onJoin }: Props) {
  const [nickname, setNickname] = useState("");
  // ref と非ref を分割代入して ESLint の react-hooks/refs 誤検知を回避
  const {
    videoRef,
    canvasRef,
    isActive,
    capturedImage,
    selectedFrame,
    setSelectedFrame,
    startCamera,
    capture,
    retake,
    error: cameraError,
    frameOptions,
  } = useCamera();

  function handleSubmit() {
    if (!nickname.trim()) return;
    onJoin(nickname.trim(), capturedImage || undefined);
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea, #764ba2)", padding: 24 }}>
      <h1 style={{ fontSize: 28, color: "#fff", marginBottom: 24 }}>プロフィール設定</h1>

      {/* ニックネーム */}
      <div style={{ marginBottom: 20, width: 280 }}>
        <label
          htmlFor="nickname"
          style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 6, fontWeight: 600 }}
        >
          ニックネーム（20文字以内）
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, 20))}
          placeholder="例：花子"
          maxLength={20}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            fontSize: 20,
            textAlign: "center",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      {/* 自撮りエリア */}
      <div style={{ marginBottom: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>自撮り（任意）</p>

        {/* カメラエラー表示 */}
        {cameraError !== null ? (
          <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(239,83,80,0.3)", color: "#fff", fontSize: 13, maxWidth: 280 }}>
            {cameraError}
          </div>
        ) : null}

        {capturedImage !== null ? (
          // 撮影済み
          <div>
            <img
              src={capturedImage}
              alt="自撮り"
              style={{ width: 200, height: 200, borderRadius: "50%", objectFit: "cover", border: "4px solid rgba(255,255,255,0.5)" }}
            />
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={retake}
                style={{ padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.3)", color: "#fff", fontSize: 14, minHeight: 44 }}
              >
                撮り直す
              </button>
            </div>
          </div>
        ) : isActive ? (
          // カメラ起動中
          <div>
            <div style={{ position: "relative", width: 200, height: 200, borderRadius: "50%", overflow: "hidden", margin: "0 auto", border: "4px solid rgba(255,255,255,0.5)" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: 200, height: 200, objectFit: "cover", transform: "scaleX(-1)" }}
              />
            </div>

            {/* フレーム選択 */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
              {frameOptions.map((frame) => (
                <button
                  key={frame.type}
                  type="button"
                  onClick={() => setSelectedFrame(frame.type)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 16,
                    background: selectedFrame === frame.type ? "#e91e63" : "rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 12,
                    minHeight: 44,
                  }}
                >
                  {frame.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={capture}
              style={{
                marginTop: 12,
                padding: "12px 32px",
                borderRadius: 24,
                background: "#e91e63",
                color: "#fff",
                fontSize: 16,
                fontWeight: "bold",
                minHeight: 44,
              }}
            >
              撮影
            </button>
          </div>
        ) : (
          // カメラ未起動
          <button
            type="button"
            onClick={startCamera}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            <span>自撮りを撮る</span>
          </button>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <button
        type="button"
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
          minHeight: 44,
        }}
      >
        参加する
      </button>
    </div>
  );
}
