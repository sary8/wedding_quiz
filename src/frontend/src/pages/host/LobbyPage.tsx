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
    <div className="h-[100dvh] bg-gradient-to-b from-blush to-white">
    <div className="h-full max-h-[1080px] max-w-[1920px] mx-auto flex flex-col items-center justify-center text-gray-900 px-6">
      {/* タイトル */}
      <header className="text-center mb-8">
        <h1 className="font-script text-6xl text-amber-800 mb-2 [text-wrap:balance]">Wedding Quiz</h1>
        <div className="flex items-center gap-3 justify-center mb-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-800/40 max-w-[80px]" />
          <span className="inline-block w-1.5 h-1.5 rotate-45 bg-amber-800/60" aria-hidden="true" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-800/40 max-w-[80px]" />
        </div>
        <p className="font-serif-wedding text-gray-600 tracking-widest text-sm uppercase">Celebration Game</p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center mb-8">
        {/* QRコード */}
        <QRCodeDisplay value={joinUrl} size={200} label="Scan to Join" />

        {/* ルームコード */}
        <div className="text-center">
          <p className="text-sm mb-2 text-gray-600 tracking-widest uppercase">Room Code</p>
          <p className="text-7xl font-bold tracking-widest text-amber-800" aria-label={`ルームコード: ${roomCode.split('').join(' ')}`}>
            {roomCode}
          </p>
          <p className="text-gray-600 text-sm mt-2">Join with your phone!</p>
        </div>
      </div>

      {/* 参加者一覧 */}
      <section className="mb-8 text-center w-full max-w-4xl">
        <h2 className="text-xl font-bold mb-4 text-gray-700 [text-wrap:balance]">
          Players: <span className="text-amber-800">{participants.length}</span>
        </h2>
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
