import { useMemo, useState, useCallback } from "react";
import { RankingPage } from "./RankingPage";
import type { RankingData, RankingEntry, TeamRankingEntry } from "../../types";

const NAMES = [
  "ゆうき", "あかり", "けんた", "みさき", "そうた", "はるか", "りく", "さくら",
  "たいが", "ゆい", "こうき", "あおい", "はると", "ひなた", "れん", "ことね",
];

function generateMockRanking(teamMode: boolean): RankingData {
  const rankings: RankingEntry[] = [];
  for (let i = 0; i < 10; i++) {
    const rank = i + 1;
    rankings.push({
      participantId: i + 1,
      nickname: NAMES[i],
      selfieUrl: null,
      totalScore: Math.max(100, 5000 - rank * 400 + Math.floor(Math.random() * 100)),
      rank,
      previousRank: rank + (Math.random() > 0.5 ? Math.floor(Math.random() * 3) : -Math.floor(Math.random() * 2)),
      lastResponseTimeMs: 1500 + rank * 200 + Math.floor(Math.random() * 500),
    });
  }

  const result: RankingData = { rankings };

  if (teamMode) {
    const teamNames = ["チーム新郎", "チーム新婦", "チーム大学", "チーム会社", "チーム親族"];
    const teamRankings: TeamRankingEntry[] = teamNames.map((name, i) => ({
      teamId: i + 1,
      teamName: name,
      totalScore: Math.max(1000, 15000 - i * 2500 + Math.floor(Math.random() * 500)),
      memberCount: 15 + Math.floor(Math.random() * 10),
      rank: i + 1,
    }));
    result.teamRankings = teamRankings;
  }

  return result;
}

const NOOP = () => {};

export function RankingDemoPage() {
  const [teamMode, setTeamMode] = useState(false);
  const [key, setKey] = useState(0);

  const mockData = useMemo(() => generateMockRanking(teamMode), [teamMode, key]);

  const handleToggleTeam = useCallback(() => {
    setTeamMode((prev) => !prev);
    setKey((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setKey((prev) => prev + 1);
  }, []);

  return (
    <div className="relative">
      <nav aria-label="デモ操作パネル" className="fixed top-2 right-2 z-50 bg-black/70 text-white text-xs rounded-lg px-3 py-2 flex flex-col gap-1">
        <span>{teamMode ? "チーム戦" : "個人戦"}</span>
        <button
          type="button"
          onClick={handleToggleTeam}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {teamMode ? "個人戦に切替" : "チーム戦に切替"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          リセット
        </button>
      </nav>

      <RankingPage key={key} data={mockData} onNextQuestion={NOOP} onEndGame={NOOP} isDisplay />
    </div>
  );
}
