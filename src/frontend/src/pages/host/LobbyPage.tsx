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
  isDisplay?: boolean;
};

export function LobbyPage({ roomCode, participants, teams, onStartGame, isDisplay = false }: Props) {
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
        <p className="font-serif-wedding text-gray-500 tracking-widest text-sm uppercase">Celebration Game</p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center mb-8">
        {/* QRコード */}
        <QRCodeDisplay value={joinUrl} size={200} label="QRコードで参加" />

        {/* ルームコード */}
        <div className="text-center">
          <p className="text-sm mb-2 text-gray-500 tracking-widest uppercase">Room Code</p>
          <p className="text-7xl font-bold tracking-widest text-amber-800" aria-label={`ルームコード: ${roomCode.split('').join(' ')}`}>
            {roomCode}
          </p>
          <p className="text-gray-500 text-sm mt-2">スマホで参加しよう！</p>
        </div>
      </div>

      {/* 参加者一覧 */}
      <section className="mb-8 text-center w-full max-w-4xl">
        <h2 className="text-xl font-bold mb-4 text-gray-700 [text-wrap:balance]">
          参加者: <span className="text-amber-800">{participants.length}</span>人
        </h2>
        {participants.length > 0 ? (
          teams && teams.length > 0 ? (
            <TeamGroupedParticipants participants={participants} teams={teams} />
          ) : (
            <ul className="flex flex-wrap gap-3 justify-center" aria-label="参加者一覧">
              {participants.map((p) => (
                <li key={p.id}>
                  <ParticipantChip nickname={p.nickname} selfieUrl={p.selfieUrl} variant="light" />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-gray-500 text-base">参加者を待っています…</p>
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
          <p className="mt-3 text-gray-500 text-xs">
            プロジェクター: {window.location.origin}/host/{roomCode}/screen
          </p>
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
            <h3 className="text-sm font-bold text-amber-700 mb-2">{team.name}（{members.length}人）</h3>
            {members.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={`${team.name}の参加者`}>
                {members.map((p) => (
                  <li key={p.id}>
                    <ParticipantChip nickname={p.nickname} selfieUrl={p.selfieUrl} variant="light" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">メンバーなし</p>
            )}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-2">未所属（{unassigned.length}人）</h3>
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
