import { Heart } from "lucide-react";

type Props = {
  message?: string;
};

export function WaitingPage({ message = "まもなく開始します..." }: Props) {
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-dark text-white">
      <div aria-hidden="true" className="mb-6 motion-safe:animate-[scale-pulse_2s_ease-in-out_infinite]">
        <Heart size={48} strokeWidth={1.5} />
      </div>
      <p className="text-xl">{message}</p>
    </div>
  );
}
