import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { normalizeRoomCode } from "../../utils/normalizeInput";

export function JoinPage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus属性はcommit直後に同期focusされforced reflowでTBTを悪化させるため、
  // 初回ペイント後（rAF）にフォーカスする
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = normalizeRoomCode(roomCode);

    if (code.length !== 6) {
      setError("6桁のルームコードを入力してください");
      return;
    }

    setError("");
    navigate(`/play/${code}`);
  }

  function handleChange(value: string) {
    setRoomCode(normalizeRoomCode(value).slice(0, 6));
    if (error) setError("");
  }

  // このページの初期見た目は index.html の静的シェルとして先行描画される（FCP/LCP対策）。
  // 構造・クラスを変えるときは index.html のシェルも同期させること。
  // エントランスアニメーションはシェル側で再生済みのため、ここでは付けない
  // （付けると React 置換時に再生し直されてチラつく）。
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-botanical overflow-hidden">
      {/* 装飾: 浮遊するリーフ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute text-primary/[0.07] motion-safe:animate-[gentle-float_6s_ease-in-out_infinite]"
            style={{
              left: `${20 + i * 30}%`,
              top: `${15 + i * 25}%`,
              animationDelay: `${i * 2}s`,
              fontSize: `${40 + i * 16}px`,
            }}
          >
            &#x1F33F;
          </span>
        ))}
      </div>

      {/* タイトル */}
      <header className="text-center mb-10 relative z-10">
        <h1 className="font-script text-7xl text-shimmer mb-2 [text-wrap:balance] drop-shadow-[0_2px_8px_rgba(107,143,113,0.15)]">
          Wedding Quiz
        </h1>
        <div className="gold-line w-48 mx-auto my-4" />
        <p className="font-serif-wedding text-sage-text/60 tracking-[0.25em] text-sm uppercase">
          Celebration Game
        </p>
      </header>

      {/* カード */}
      <div className="w-full max-w-xs glass-card-strong rounded-3xl p-8 relative z-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Input
            ref={inputRef}
            type="text"
            value={roomCode}
            onChange={(e) => handleChange(e.target.value)}
            onCompositionEnd={(e) => handleChange((e.target as HTMLInputElement).value)}
            placeholder="XXXXXX"
            maxLength={6}
            label="ルームコード（6桁）"
            error={error}
            className="text-3xl tracking-[0.3em] text-center font-bold"
            autoComplete="off"
            inputMode="numeric"
            spellCheck={false}
          />

          <Button
            type="submit"
            variant="accent"
            size="lg"
            fullWidth
            disabled={roomCode.length !== 6}
          >
            参加する
          </Button>
        </form>
      </div>

      {/* フッター装飾 */}
      <p className="mt-10 text-primary/50 text-xs font-serif-wedding tracking-widest relative z-10">
        本日はご参加いただきありがとうございます
      </p>
    </div>
  );
}
