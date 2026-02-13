import type { ParticipantInfo } from "../../types";
import { Button } from "../../components/ui";
import { ParticipantChip, QRCodeDisplay } from "../../components/quiz";

type Props = {
  roomCode: string;
  participants: ParticipantInfo[];
  onStartGame: () => void;
};

export function LobbyPage({ roomCode, participants, onStartGame }: Props) {
  const joinUrl = `${window.location.origin}/play/${roomCode}`;

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-dark text-white px-6">
      <header className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-2">Wedding Quiz</h1>
        <p className="text-xl opacity-80">スマホで参加しよう！</p>
      </header>

      <div className="flex flex-col md:flex-row gap-12 items-center mb-8">
        {/* QRコード */}
        <QRCodeDisplay value={joinUrl} size={200} label="QRコードで参加" />

        {/* ルームコード */}
        <div className="text-center">
          <p className="text-base mb-2 opacity-80">ルームコード</p>
          <p className="text-7xl font-bold tracking-widest" aria-label={`ルームコード: ${roomCode.split('').join(' ')}`}>
            {roomCode}
          </p>
        </div>
      </div>

      {/* 参加者一覧 */}
      <section className="mb-8 text-center w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">
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
          <p className="text-white/60 text-lg">参加者を待っています...</p>
        )}
      </section>

      <Button
        onClick={onStartGame}
        disabled={participants.length === 0}
        variant="accent"
        size="lg"
        aria-disabled={participants.length === 0}
      >
        ゲーム開始
      </Button>
    </div>
  );
}
