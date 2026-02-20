import { Avatar } from "../ui/Avatar";
import { cn } from "../../utils/cn";

type Props = {
  nickname: string;
  selfieUrl?: string | null;
  variant?: "dark" | "light";
  className?: string;
};

export function ParticipantChip({ nickname, selfieUrl, variant = "dark", className }: Props) {
  const isLight = variant === "light";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-1.5",
        "transition-colors",
        isLight
          ? "bg-rose-text/10 hover:bg-rose-text/20"
          : "bg-white/20 hover:bg-white/30",
        className
      )}
    >
      <Avatar
        src={selfieUrl ?? undefined}
        alt={`${nickname}のアバター`}
        fallback={nickname}
        size="sm"
      />
      <span className={cn("text-sm font-medium", isLight ? "text-rose-text" : "text-white")}>
        {nickname}
      </span>
    </div>
  );
}
