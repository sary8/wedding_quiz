import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FinalPage } from "./FinalPage";
import { useGameSounds } from "../../hooks/useGameSounds";
import type { FinalResultData, FinalRankingEntry, TeamRankingEntry } from "../../types";

const NAMES = [
  // 1文字
  "凛", "蓮", "葵", "翠",
  // 2文字
  "ゆい", "そら", "めい", "れん",
  // 3文字
  "はると", "あおい", "ひなた", "さくら",
  // 4文字
  "ゆうきち", "みさきこ", "けんたろ", "ことねこ",
  // 5文字
  "たいがくん", "あかりちゃ", "こうきろう", "ひまりんご",
  // 6文字
  "しょうたろう", "かのんちゃん", "りゅうのすけ", "さやかちゃん",
  // 7文字
  "けんたろうくん", "みさきちゃんこ", "ゆうせいたろう", "はるかぜのこえ",
  // 8文字
  "しょうたろうくん", "ひなたぼっこちゃ", "りゅうのすけくん", "かすみそうたろう",
  // 混合（実際のゲストを想定）
  "ゆうき", "あかり", "けんた", "みさき", "そうた", "はるか", "りく",
  "たいが", "こうき", "れんたろう", "かいと", "まお", "りこ",
  "ゆうと", "あさひ", "りょう", "すず", "だいき", "ほのか", "しゅん",
  "みお", "いつき", "あかね", "かなた", "ちひろ", "はやと", "のどか",
  "まさき", "みなみ", "ともや", "きらら", "たくみ", "ふうか", "ゆうま",
  "あや", "なおき", "しおり", "けいた", "るな", "ひろき", "まなみ",
  "じゅん", "ここあ", "たける", "ゆきの", "しんや", "えみり", "こうへい",
  "みずき", "ななみ", "あきら", "ちさと", "まなと", "あいり", "かすみ",
  "たいち", "しほ", "げんき", "まりな", "そうま", "ゆかり", "けんじ",
  "ありさ", "こうた", "さやか", "あつし", "れいな",
];

function generateMockData(count: number, teamMode: boolean): FinalResultData {
  const rankings: FinalRankingEntry[] = [];

  for (let i = 0; i < count; i++) {
    const rank = i + 1;
    const baseScore = Math.max(100, 5000 - rank * 40 + Math.floor(Math.random() * 30));
    const avgTime = 1500 + rank * 30 + Math.floor(Math.random() * 500);
    const correctCount = Math.max(1, 10 - Math.floor(rank / 12));

    rankings.push({
      participantId: i + 1,
      nickname: NAMES[i % NAMES.length] + (i >= NAMES.length ? `${Math.floor(i / NAMES.length) + 1}` : ""),
      selfieUrl: null,
      totalScore: baseScore,
      rank,
      previousRank: rank,
      lastResponseTimeMs: avgTime,
      correctCount,
      totalQuestions: 10,
      averageResponseTimeMs: avgTime,
      fastestResponseTimeMs: Math.max(500, avgTime - 800),
    });
  }

  const result: FinalResultData = { rankings };

  if (teamMode) {
    const teamNames = ["チーム新郎", "チーム新婦", "チーム大学", "チーム会社", "チーム親族"];
    const teamRankings: TeamRankingEntry[] = teamNames.map((name, i) => ({
      teamId: i + 1,
      teamName: name,
      totalScore: Math.max(1000, 15000 - i * 2500 + Math.floor(Math.random() * 500)),
      memberCount: Math.floor(count / teamNames.length),
      rank: i + 1,
    }));
    result.teamRankings = teamRankings;
  }

  return result;
}

export function FinalDemoPage() {
  const [searchParams] = useSearchParams();
  const count = Math.min(200, Math.max(5, Number(searchParams.get("count")) || 100));
  const teamMode = searchParams.get("team") === "true";

  const { playDrumRoll, playFanfare } = useGameSounds();

  const [revealTrigger, setRevealTrigger] = useState(0);
  const [key, setKey] = useState(0);

  const mockData = useMemo(() => generateMockData(count, teamMode), [count, teamMode, key]);

  const handleRevealNext = useCallback(() => {
    setRevealTrigger((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setKey((prev) => prev + 1);
    setRevealTrigger(0);
  }, []);

  return (
    <div className="relative">
      {/* コントロールパネル */}
      <nav aria-label="デモ操作パネル" className="fixed top-2 right-2 z-50 bg-black/70 text-white text-xs rounded-lg px-3 py-2 flex flex-col gap-1">
        <span>{count}人 {teamMode ? "/ チーム戦" : ""}</span>
        <button
          type="button"
          onClick={handleReset}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          リセット
        </button>
      </nav>

      <FinalPage
        key={key}
        data={mockData}
        onRevealNext={handleRevealNext}
        revealTrigger={revealTrigger}
        onDrumRoll={playDrumRoll}
        onSpotlight={playFanfare}
        onReplay={handleReset}
      />
    </div>
  );
}
