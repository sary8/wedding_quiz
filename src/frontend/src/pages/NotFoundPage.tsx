import { useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-blush px-6 text-center">
      <p className="font-script text-8xl text-primary mb-2">404</p>

      <div className="flex items-center gap-3 justify-center mb-4 w-40">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
        <span className="text-accent/60 text-xs">◆</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
      </div>

      <p className="font-serif-wedding text-rose-text/70 text-lg mb-8">
        お探しのページは見つかりませんでした
      </p>

      <button
        type="button"
        onClick={() => navigate("/play")}
        className="px-8 py-4 rounded-xl bg-primary text-white text-base font-bold hover:opacity-90 transition-opacity duration-200 min-h-[44px] shadow-[0_4px_16px_rgba(219,39,119,0.3)]"
      >
        トップへ戻る
      </button>
    </div>
  );
}
