import { Heart } from "lucide-react";

type Props = {
  message?: string;
  roomCode?: string;
};

export function WaitingPage({ message = "まもなく開始します…", roomCode }: Props) {
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-blush">
      {/* ゴールドハート */}
      <div
        aria-hidden="true"
        className="mb-6 text-accent motion-safe:animate-[scale-pulse_2s_ease-in-out_infinite]"
      >
        <Heart size={56} strokeWidth={1.5} />
      </div>

      {/* タイトル */}
      <h1 className="font-script text-4xl text-primary mb-2 [text-wrap:balance]">Wedding Quiz</h1>

      {/* セパレーター */}
      <div className="flex items-center gap-3 mb-4 w-40">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
        <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent/60" aria-hidden="true" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
      </div>

      <p className="text-rose-text/80 text-base" aria-live="polite">{message}</p>

      {roomCode && (
        <p className="mt-4 text-xs text-gray-500">
          ルームコード: <span className="font-mono font-bold text-gray-600">{roomCode}</span>
        </p>
      )}
    </div>
  );
}
