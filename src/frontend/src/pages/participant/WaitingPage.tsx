import { Heart } from "lucide-react";

type Props = {
  message?: string;
};

export function WaitingPage({ message = "まもなく開始します..." }: Props) {
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
      <h1 className="font-script text-4xl text-primary mb-2">Wedding Quiz</h1>

      {/* セパレーター */}
      <div className="flex items-center gap-3 mb-4 w-40">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
        <span className="text-accent/60 text-xs">◆</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
      </div>

      <p className="text-rose-text/80 text-base">{message}</p>
    </div>
  );
}
