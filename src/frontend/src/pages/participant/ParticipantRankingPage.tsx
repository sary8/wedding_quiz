import { useMemo } from "react";
import { Trophy } from "lucide-react";
import type { RankingData } from "../../types";

type Props = {
  data: RankingData | null;
  participantId: number | null;
};

export function ParticipantRankingPage({ data, participantId }: Props) {
  const myEntry = useMemo(
    () => (data && participantId) ? data.rankings.find((r) => r.participantId === participantId) : null,
    [data, participantId],
  );
  const top5 = useMemo(() => data ? data.rankings.slice(0, 5) : [], [data]);

  if (!data) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-blush text-gray-900 gap-3">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-lg text-gray-600">ランキングを読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-blush">
      {/* チーム順位 */}
      {data.teamRankings && data.teamRankings.length > 0 && (
        <div className="flex-shrink-0 flex flex-col items-center pt-6 pb-2 px-4">
          <div className="px-5 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
            {data.teamRankings.map((t) => (
              <p key={t.teamId} className="text-sm font-bold text-amber-800 text-center">
                {t.teamName}: 第{t.rank}位（{t.totalScore.toLocaleString()}点）
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 自分の順位 */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center pt-10 pb-6 px-4">
        <div className="text-accent mb-3" aria-hidden="true">
          <Trophy size={48} strokeWidth={1.5} />
        </div>
        {myEntry ? (
          <>
            <p className="text-5xl font-extrabold text-primary">
              第{myEntry.rank}位
            </p>
            <p className="text-lg text-gray-700 mt-2">
              {myEntry.totalScore}点
            </p>
          </>
        ) : (
          <p className="text-xl text-gray-600">あなたの順位を確認中…</p>
        )}
      </div>

      {/* セパレーター */}
      <div className="flex items-center gap-3 mx-auto w-40 mb-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-accent/40" />
        <span className="inline-block w-1.5 h-1.5 rotate-45 bg-accent/60" aria-hidden="true" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-accent/40" />
      </div>

      {/* 上位5名ミニランキング */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3 text-center">上位ランキング</h2>
        <ul className="space-y-2 max-w-sm mx-auto">
          {top5.map((entry) => {
            const isMe = entry.participantId === participantId;
            return (
              <li
                key={entry.participantId}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                  isMe ? "bg-pink-100 ring-2 ring-pink-300" : "bg-white/80"
                }`}
              >
                <span className="text-lg font-bold text-accent w-8 text-center shrink-0">
                  {entry.rank}
                </span>
                {entry.selfieUrl ? (
                  <img
                    src={entry.selfieUrl}
                    alt={entry.nickname}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                )}
                <span className={`flex-1 text-sm font-medium truncate ${isMe ? "text-pink-900 font-bold" : "text-gray-800"}`}>
                  {entry.nickname}{isMe ? "（あなた）" : ""}
                </span>
                <span className="text-sm text-gray-600 shrink-0">{entry.totalScore}点</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
