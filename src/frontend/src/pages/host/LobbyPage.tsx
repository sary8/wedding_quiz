import { useMemo } from "react";
import type { ParticipantInfo, TeamInfo } from "../../types";
import { Button } from "../../components/ui/Button";
import { ParticipantChip } from "../../components/quiz/ParticipantChip";
import { QRCodeDisplay } from "../../components/quiz/QRCodeDisplay";

type Props = {
  roomCode: string;
  participants: ParticipantInfo[];
  teams?: TeamInfo[];
  onStartGame: () => void;
  onBack?: () => void;
  isDisplay?: boolean;
  isProcessing?: boolean;
};

export function LobbyPage({ roomCode, participants, teams, onStartGame, onBack, isDisplay = false, isProcessing = false }: Props) {
  const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
  const joinUrl = `${appOrigin}/play/${roomCode}`;

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-[#F0F5F1] via-[#F5F0E8] to-[#EFF5F0] overflow-hidden">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col items-center justify-center text-sage-text px-6 bg-botanical relative">
      {/* タイトル */}
      <header className="text-center mb-10 animate-fade-up">
        <h1 className="font-script text-7xl md:text-8xl text-shimmer mb-3 [text-wrap:balance] drop-shadow-[0_2px_12px_rgba(107,143,113,0.12)]">
          Quiz Party
        </h1>
        <div className="gold-line w-56 mx-auto my-4" />
        <p className="font-serif-wedding text-sage-text/50 tracking-[0.3em] text-sm uppercase">Party Game</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center mb-10 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {/* QRコード */}
        <div className="glass-card-strong rounded-3xl p-6">
          <QRCodeDisplay value={joinUrl} size={200} label="Scan to Join" />
        </div>

        {/* ルームコード */}
        <div className="text-center">
          <p className="text-xs mb-3 text-sage-text/50 tracking-[0.3em] uppercase font-serif-wedding">Room Code</p>
          <p className="text-8xl md:text-9xl font-bold tracking-[0.2em] text-primary drop-shadow-[0_2px_8px_rgba(107,143,113,0.1)]" aria-label={`ルームコード: ${roomCode.split('').join(' ')}`}>
            {roomCode}
          </p>
          <p className="text-sage-text/50 text-sm mt-3 font-serif-wedding tracking-wider">Join with your phone!</p>
        </div>
      </div>

      {/* 参加者一覧 */}
      <section className="mb-8 text-center w-full max-w-4xl animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <h2 className="text-lg font-serif-wedding tracking-wider mb-4 text-sage-text/70">
          Players <span className="text-accent font-bold text-2xl ml-2 [font-variant-numeric:tabular-nums]">{participants.length}</span>
        </h2>
        <div className="max-h-[35vh] overflow-y-auto">
          {participants.length > 0 ? (
            teams && teams.length > 0 ? (
              <TeamGroupedParticipants participants={participants} teams={teams} />
            ) : (
              <ul className="flex flex-wrap gap-3 justify-center" aria-label="参加者一覧">
                {participants.map((p) => (
                  <li key={p.id} className="cv-auto">
                    <ParticipantChip nickname={p.nickname} selfieUrl={p.selfieUrl} variant="light" />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-gray-600 text-base">Waiting for players…</p>
          )}
        </div>
      </section>

      {!isDisplay && (
        <>
          <div className="flex gap-4 items-center">
            {onBack && (
              <Button
                onClick={onBack}
                size="lg"
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                戻る
              </Button>
            )}
            <Button
              onClick={onStartGame}
              disabled={participants.length === 0 || isProcessing}
              variant="accent"
              size="lg"
              aria-disabled={participants.length === 0 || isProcessing}
            >
              ゲーム開始
            </Button>
          </div>
          <button
            type="button"
            onClick={() => window.open(`${window.location.origin}/host/${roomCode}/screen`, '_blank', 'noopener')}
            className="mt-2 text-gray-500 text-xs hover:text-gray-700 hover:underline transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 rounded inline-flex items-center gap-1 py-1 px-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            プロジェクター画面を開く
          </button>
        </>
      )}
    </div>
    </div>
  );
}

type TeamGroupedProps = {
  participants: ParticipantInfo[];
  teams: TeamInfo[];
};

function TeamGroupedParticipants({ participants, teams }: TeamGroupedProps) {
  const grouped = useMemo(() => {
    const map = new Map<number | null, ParticipantInfo[]>();
    for (const p of participants) {
      const key = p.teamId ?? null;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [participants]);

  const unassigned = grouped.get(null) ?? [];

  return (
    <div className="space-y-4 text-left">
      {teams.map((team) => {
        const members = grouped.get(team.id) ?? [];
        return (
          <div key={team.id}>
            <h3 className="text-sm font-bold text-amber-700 mb-2">{team.name} ({members.length})</h3>
            {members.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={`${team.name}の参加者`}>
                {members.map((p) => (
                  <li key={p.id} className="cv-auto">
                    <ParticipantChip nickname={p.nickname} selfieUrl={p.selfieUrl} variant="light" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No members</p>
            )}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-2">Unassigned ({unassigned.length})</h3>
          <ul className="flex flex-wrap gap-2" aria-label="未所属の参加者">
            {unassigned.map((p) => (
              <li key={p.id}>
                <ParticipantChip nickname={p.nickname} selfieUrl={p.selfieUrl} variant="light" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
