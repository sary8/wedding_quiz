import { useMemo, useState, useCallback } from "react";
import { RankingPage } from "./RankingPage";
import type { RankingData, RankingEntry, TeamRankingEntry, RankingViewMode, QuestionRankingEntry, QuestionTeamRankingEntry } from "../../types";

const NAMES = [
  "ゆうき", "あかりんりん", "けんた", "みさきちゃん大好", "そうた", "はるか", "りく", "さくら",
  "たいが", "おおたにしょうへ", "こうき", "あおい", "はると", "ひなた", "れん", "ことね",
  "しゅん", "まお", "だいすけまる", "ゆな", "かいと", "ももかぴーす", "りょう", "あやね",
  "ゆうま", "みゆ", "そら", "りお", "こうせい", "のぞみ", "いつき", "ほのか",
  "かずま", "えみ", "たくみ", "さき", "けいた", "あいり", "しょう", "みく",
];

const TEAM_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const PARTICIPANT_COUNT = 35;

function generateMockRanking(teamMode: boolean, questionMode: boolean): RankingData {
  const rankings: RankingEntry[] = [];
  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const rank = i + 1;
    rankings.push({
      participantId: i + 1,
      nickname: NAMES[i % NAMES.length] + (i >= NAMES.length ? `${Math.floor(i / NAMES.length) + 1}` : ""),
      selfieUrl: null,
      totalScore: Math.max(100, 150000 - rank * 3500 + Math.floor(Math.random() * 2000)),
      rank,
      previousRank: rank + (Math.random() > 0.5 ? Math.floor(Math.random() * 3) : -Math.floor(Math.random() * 2)),
      lastResponseTimeMs: 1500 + rank * 200 + Math.floor(Math.random() * 500),
    });
  }

  const result: RankingData = { rankings, maxPossibleScore: 150000 };

  if (teamMode) {
    const teamRankings: TeamRankingEntry[] = TEAM_NAMES.map((name, i) => ({
      teamId: i + 1,
      teamName: name,
      totalScore: Math.max(10000, 450000 - i * 35000 + Math.floor(Math.random() * 5000)),
      memberCount: 5 + Math.floor(Math.random() * 15),
      rank: i + 1,
      previousRank: i + 1 + (Math.random() > 0.5 ? Math.floor(Math.random() * 3) : -Math.floor(Math.random() * 2)),
    }));
    result.teamRankings = teamRankings;
  }

  if (questionMode) {
    const shuffled = Array.from({ length: PARTICIPANT_COUNT }, (_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const qRankings: QuestionRankingEntry[] = shuffled.map((orig, i) => ({
      participantId: orig + 1,
      nickname: NAMES[orig % NAMES.length] + (orig >= NAMES.length ? `${Math.floor(orig / NAMES.length) + 1}` : ""),
      selfieUrl: null,
      scoreAwarded: Math.max(0, 1000 - (i + 1) * 20 + Math.floor(Math.random() * 50)),
      responseTimeMs: 1000 + (i + 1) * 100 + Math.floor(Math.random() * 500),
      rank: i + 1,
    }));

    result.questionRanking = {
      questionIndex: 2,
      questionText: "新郎が初めてプロポーズした場所は？",
      maxQuestionScore: 1000,
      rankings: qRankings,
    };

    if (teamMode) {
      const qTeamRankings: QuestionTeamRankingEntry[] = TEAM_NAMES.slice(0, 5).map((name, i) => ({
        teamId: i + 1,
        teamName: name,
        totalScore: Math.max(500, 5000 - i * 800 + Math.floor(Math.random() * 300)),
        memberCount: 5 + Math.floor(Math.random() * 10),
        rank: i + 1,
      }));
      result.questionRanking.teamRankings = qTeamRankings;
    }
  }

  return result;
}

const NOOP = () => {};

export function RankingDemoPage() {
  const [teamMode, setTeamMode] = useState(false);
  const [questionMode, setQuestionMode] = useState(false);
  const [viewMode, setViewMode] = useState<"host" | "display">("host");
  const [key, setKey] = useState(0);
  const [displayPage, setDisplayPage] = useState(0);
  const [displayMode, setDisplayMode] = useState<RankingViewMode>("individual");

  const mockData = useMemo(() => generateMockRanking(teamMode, questionMode), [teamMode, questionMode, key]);

  const handleToggleTeam = useCallback(() => {
    setTeamMode((prev) => !prev);
    setKey((prev) => prev + 1);
    setDisplayPage(0);
    setDisplayMode(questionMode ? "questionIndividual" : "individual");
  }, [questionMode]);

  const handleToggleQuestion = useCallback(() => {
    setQuestionMode((prev) => {
      const next = !prev;
      setDisplayMode(next ? "questionIndividual" : "individual");
      return next;
    });
    setKey((prev) => prev + 1);
    setDisplayPage(0);
  }, []);

  const handleReset = useCallback(() => {
    setKey((prev) => prev + 1);
    setDisplayPage(0);
    setDisplayMode(questionMode ? "questionIndividual" : "individual");
  }, [questionMode]);

  const handleRankingViewChange = useCallback((page: number, mode: RankingViewMode) => {
    setDisplayPage(page);
    setDisplayMode(mode);
  }, []);

  const isDisplay = viewMode === "display";

  return (
    <div className="relative">
      <nav aria-label="デモ操作パネル" className="fixed top-2 right-2 z-50 bg-black/70 text-white text-xs rounded-lg px-3 py-2 flex flex-col gap-1">
        <span>{teamMode ? "チーム戦" : "個人戦"} / {questionMode ? "問題別" : "合計"} / {isDisplay ? "スクリーン" : "ホスト"}</span>
        <button
          type="button"
          onClick={handleToggleTeam}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {teamMode ? "個人戦に切替" : "チーム戦に切替"}
        </button>
        <button
          type="button"
          onClick={handleToggleQuestion}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {questionMode ? "合計ランキングに切替" : "問題別ランキングに切替"}
        </button>
        <button
          type="button"
          onClick={() => setViewMode((v) => v === "host" ? "display" : "host")}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {isDisplay ? "ホスト表示に切替" : "スクリーン表示に切替"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="bg-white/20 rounded px-3 py-2 min-h-[44px] hover:bg-white/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          リセット
        </button>
      </nav>

      <RankingPage
        key={`${key}-${viewMode}`}
        data={mockData}
        onNextQuestion={NOOP}
        onEndGame={NOOP}
        isDisplay={isDisplay}
        rankingPage={isDisplay ? displayPage : undefined}
        rankingMode={isDisplay ? displayMode : undefined}
        onRankingViewChange={isDisplay ? undefined : handleRankingViewChange}
      />
    </div>
  );
}
