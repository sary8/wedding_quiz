import { Heart } from "lucide-react";

type Props = {
  message?: string;
  roomCode?: string;
};

export function WaitingPage({ message = "まもなく開始します…", roomCode }: Props) {
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-botanical overflow-hidden">
      {/* ゴールドハート */}
      <div
        aria-hidden="true"
        className="mb-8 text-accent motion-safe:animate-[scale-pulse_2s_ease-in-out_infinite] drop-shadow-[0_4px_12px_rgba(202,138,4,0.2)]"
      >
        <Heart size={64} strokeWidth={1.2} fill="currentColor" fillOpacity={0.15} />
      </div>

      {/* タイトル */}
      <h1 className="font-script text-5xl text-primary mb-3 [text-wrap:balance] animate-fade-up">
        Quiz Party
      </h1>

      {/* セパレーター */}
      <div className="gold-line w-32 mb-6" />

      <div className="glass-card rounded-2xl px-8 py-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <p className="text-sage-text text-base text-center" aria-live="polite">{message}</p>
      </div>

      {roomCode && (
        <p className="mt-6 text-xs text-sage-text/40 font-serif-wedding tracking-widest">
          Room <span className="font-mono font-bold text-sage-text/60">{roomCode}</span>
        </p>
      )}
    </div>
  );
}
