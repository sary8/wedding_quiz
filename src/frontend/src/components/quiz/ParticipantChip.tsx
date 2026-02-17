import { Avatar } from "../ui/Avatar";
import { cn } from "../../utils/cn";

type Props = {
  nickname: string;
  selfieUrl?: string | null;
  className?: string;
};

export function ParticipantChip({ nickname, selfieUrl, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5",
        "transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        className
      )}
    >
      <Avatar
        src={selfieUrl ?? undefined}
        alt={`${nickname}のアバター`}
        fallback={nickname}
        size="sm"
      />
      <span className="text-sm font-medium text-white">{nickname}</span>
    </div>
  );
}
