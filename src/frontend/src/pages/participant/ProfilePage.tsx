import { useState, useCallback } from "react";
import { useCamera } from "../../hooks/useCamera";
import type { TeamInfo } from "../../types";

type Props = {
  onJoin: (nickname: string, selfieData?: string, teamId?: number) => void;
  isJoining: boolean;
  teams?: TeamInfo[];
};

export function ProfilePage({ onJoin, isJoining, teams }: Props) {
  const [nickname, setNickname] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>(undefined);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const {
    videoRef,
    canvasRef,
    isActive,
    capturedImage,
    startCamera,
    capture,
    retake,
    error: cameraError,
  } = useCamera();

  const handleCapture = useCallback(() => {
    setCaptureError(null);
    const result = capture();
    if (result === null) {
      setCaptureError("カメラの準備ができていません。少し待ってからもう一度お試しください。");
    }
  }, [capture]);

  const hasTeams = teams && teams.length > 0;

  function handleSubmit() {
    if (!nickname.trim() || !capturedImage || isJoining) return;
    if (hasTeams && selectedTeamId == null) return;
    onJoin(nickname.trim(), capturedImage, selectedTeamId);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-blush px-6 py-8">
      {/* タイトル */}
      <header className="text-center mb-6">
        <h1 className="font-script text-4xl text-primary mb-1 [text-wrap:balance]">プロフィール設定</h1>
        <div className="flex items-center gap-3 justify-center">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
          <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent" aria-hidden="true" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
        </div>
      </header>

      {/* カード */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-[0_4px_32px_rgba(219,39,119,0.12)] border border-primary/10 p-6 flex flex-col items-center gap-5">

        {/* ニックネーム */}
        <div className="w-full">
          <label
            htmlFor="nickname"
            className="block text-sm font-semibold text-rose-text/80 mb-1.5"
          >
            ニックネーム（20文字以内）
          </label>
          <input
            id="nickname"
            type="text"
            name="nickname"
            autoComplete="nickname"
            spellCheck={false}
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            placeholder="例：花子…"
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 text-xl text-center text-rose-text focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-[border-color,box-shadow] duration-200"
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleSubmit()}
          />
        </div>

        {/* チーム選択 */}
        {hasTeams && (
          <div className="w-full">
            <p className="text-sm font-semibold text-rose-text/80 mb-2">チームを選択</p>
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={[
                    "px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 min-h-[44px] cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    selectedTeamId === team.id
                      ? "bg-primary text-white ring-2 ring-primary shadow-md"
                      : "bg-primary/10 text-primary hover:bg-primary/20",
                  ].join(" ")}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 自撮りエリア */}
        <div className="text-center">
          <p className="text-sm text-rose-text/70 mb-3">自撮り（必須）</p>

          {cameraError !== null ? (
            <div className="mb-3 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
              {cameraError}
            </div>
          ) : null}

          {capturedImage !== null ? (
            <div>
              <img
                src={capturedImage}
                alt="自撮り"
                width={176}
                height={176}
                className="w-44 h-44 rounded-full object-cover mx-auto border-4 border-primary/30 shadow-md"
              />
              <button
                type="button"
                onClick={retake}
                className="mt-3 px-5 py-2.5 rounded-full bg-white border border-primary/30 text-primary text-sm hover:bg-primary/5 transition-colors duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                撮り直す
              </button>
            </div>
          ) : isActive ? (
            <div>
              <div className="w-44 h-44 rounded-full overflow-hidden mx-auto border-4 border-primary/30 shadow-md">
                <video
                  ref={videoRef}
                  width={176}
                  height={176}
                  autoPlay
                  playsInline
                  muted
                  aria-label="カメラプレビュー"
                  className="w-44 h-44 object-cover scale-x-[-1]"
                />
              </div>

              {captureError !== null ? (
                <p className="mt-2 text-sm text-red-500">{captureError}</p>
              ) : null}
              <button
                type="button"
                onClick={handleCapture}
                className="mt-3 px-8 py-3 rounded-full bg-primary text-white text-base font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                撮影
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="w-44 h-44 rounded-full border-2 border-dashed border-primary/30 bg-primary/5 text-primary flex flex-col items-center justify-center gap-2 hover:bg-primary/10 transition-colors duration-200 mx-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              <span className="text-sm">自撮りを撮る</span>
            </button>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* 参加ボタン */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!nickname.trim() || !capturedImage || isJoining || (hasTeams && selectedTeamId == null)}
          className={[
            "w-full py-4 rounded-xl text-xl font-bold transition-[background-color,opacity,box-shadow] duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            nickname.trim() && capturedImage && !isJoining && (!hasTeams || selectedTeamId != null)
              ? "bg-primary text-white hover:opacity-90 shadow-[0_4px_16px_rgba(219,39,119,0.3)]"
              : "bg-primary/20 text-primary/40 cursor-not-allowed",
          ].join(" ")}
        >
          {isJoining ? "参加中…" : "参加する"}
        </button>
      </div>
    </div>
  );
}
