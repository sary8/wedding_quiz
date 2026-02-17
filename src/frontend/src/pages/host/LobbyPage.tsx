import type { ParticipantInfo } from "../../types";
import { Button } from "../../components/ui/Button";
import { ParticipantChip } from "../../components/quiz/ParticipantChip";
import { QRCodeDisplay } from "../../components/quiz/QRCodeDisplay";

type Props = {
  roomCode: string;
  participants: ParticipantInfo[];
  onStartGame: () => void;
  isDisplay?: boolean;
};

export function LobbyPage({ roomCode, participants, onStartGame, isDisplay = false }: Props) {
  const joinUrl = `${window.location.origin}/play/${roomCode}`;

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-dark text-white px-6">
      {/* タイトル */}
      <header className="text-center mb-8">
        <h1 className="font-script text-6xl text-accent mb-2">Wedding Quiz</h1>
        <div className="flex items-center gap-3 justify-center mb-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40 max-w-[80px]" />
          <span className="text-accent/60 text-xs">◆</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40 max-w-[80px]" />
        </div>
        <p className="font-serif-wedding text-white/50 tracking-widest text-sm uppercase">Celebration Game</p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center mb-8">
        {/* QRコード */}
        <QRCodeDisplay value={joinUrl} size={200} label="QRコードで参加" />

        {/* ルームコード */}
        <div className="text-center">
          <p className="text-sm mb-2 text-white/50 tracking-widest uppercase">Room Code</p>
          <p className="text-7xl font-bold tracking-widest text-accent" aria-label={`ルームコード: ${roomCode.split('').join(' ')}`}>
            {roomCode}
          </p>
          <p className="text-white/40 text-sm mt-2">スマホで参加しよう！</p>
        </div>
      </div>

      {/* 参加者一覧 */}
      <section className="mb-8 text-center w-full max-w-4xl">
        <h2 className="text-xl font-bold mb-4 text-white/80">
          参加者: <span className="text-accent">{participants.length}</span>人
        </h2>
        {participants.length > 0 ? (
          <ul className="flex flex-wrap gap-3 justify-center" aria-label="参加者一覧">
            {participants.map((p) => (
              <li key={p.id}>
                <ParticipantChip nickname={p.nickname} selfieUrl={p.selfieUrl} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-white/40 text-base">参加者を待っています…</p>
        )}
      </section>

      {!isDisplay && (
        <>
          <Button
            onClick={onStartGame}
            disabled={participants.length === 0}
            variant="accent"
            size="lg"
            aria-disabled={participants.length === 0}
          >
            ゲーム開始
          </Button>
          <p className="mt-3 text-white/30 text-xs">
            プロジェクター: {window.location.origin}/host/{roomCode}/screen
          </p>
        </>
      )}
    </div>
  );
}
