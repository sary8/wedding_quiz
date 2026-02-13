import { Avatar } from "../ui";
import { cn } from "../../utils/cn";

type Props = {
  nickname: string;
  selfieUrl?: string;
  className?: string;
};

export function ParticipantChip({ nickname, selfieUrl, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5",
        "transition-all hover:bg-white/30",
        className
      )}
    >
      <Avatar
        src={selfieUrl}
        alt={`${nickname}のアバター`}
        fallback={nickname}
        size="sm"
      />
      <span className="text-sm font-medium text-white">{nickname}</span>
    </div>
  );
}
