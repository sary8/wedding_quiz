import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FinalPage } from "./FinalPage";
import type { FinalResultData, FinalRankingEntry, TeamRankingEntry } from "../../types";

// 紙吹雪は動的 import されるためモックする
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

function makeEntry(rank: number): FinalRankingEntry {
  return {
    participantId: rank,
    nickname: `P${rank}`,
    selfieUrl: null,
    totalScore: (6 - rank) * 100,
    rank,
    previousRank: rank,
    lastResponseTimeMs: 1000,
    correctCount: 6 - rank,
    totalQuestions: 5,
    averageResponseTimeMs: 2000,
    fastestResponseTimeMs: 1000,
  };
}

// rank1〜5 のみ → バッチ（11位以下）は空 & 自動スクロール対象（6位以下）も無し。
// batchScroll から即 finalReveal に入り、最初から手動発表ボタンが出る
const rankings = [1, 2, 3, 4, 5].map(makeEntry);

const teamRankings: TeamRankingEntry[] = [
  { teamId: 1, teamName: "レッド", totalScore: 500, memberCount: 2, rank: 1 },
  { teamId: 2, teamName: "ブルー", totalScore: 300, memberCount: 3, rank: 2 },
];

const teamData: FinalResultData = { rankings, teamRankings };
const soloData: FinalResultData = { rankings };

// finalReveal の「第N位を発表」を1位まで順にクリックし、done への遷移をタイマーで確定させる
function revealAllIndividuals() {
  for (let i = 0; i < rankings.length; i++) {
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /位を発表/ }));
    });
  }
  // 1位発表後、3秒で done へ
  act(() => {
    vi.advanceTimersByTime(3000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("FinalPage の発表順（個人 → チーム）", () => {
  it("チーム戦でも最初は個人発表から始まり、チーム結果は先に出さない", () => {
    render(<FinalPage data={teamData} onRevealNext={vi.fn()} onShowParticipantResults={vi.fn()} />);

    // 個人発表（Final Results）が表示され、チーム結果はまだ出ていない
    expect(screen.getByText("Final Results")).toBeInTheDocument();
    expect(screen.queryByText("Team Results")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /位を発表/ })).toBeInTheDocument();
  });

  it("個人1位発表 → done でチーム発表ボタン → チーム発表完了時に参加者へ結果公開", () => {
    const onShow = vi.fn();
    render(<FinalPage data={teamData} onRevealNext={vi.fn()} onShowParticipantResults={onShow} />);

    revealAllIndividuals();

    // done: 個人1位のスポットライトと「チーム結果を発表」ボタン
    expect(screen.getByText("1st Place")).toBeInTheDocument();
    const teamButton = screen.getByRole("button", { name: "チーム結果を発表" });
    // チーム戦では done 時点ではまだ参加者へ公開しない（チーム成績のネタバレ防止）
    expect(onShow).not.toHaveBeenCalled();

    // チーム発表へ
    act(() => {
      fireEvent.click(teamButton);
    });
    act(() => {
      vi.advanceTimersByTime(600); // 最初のチームが表示される
    });
    expect(screen.getByText("Team Results")).toBeInTheDocument();
    expect(onShow).not.toHaveBeenCalled(); // 発表途中はまだ公開しない

    // 全チーム発表が終わると参加者へ結果公開（1回だけ）
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it("個人戦は done で参加者へ結果公開し、チーム発表ボタンは出ない", () => {
    const onShow = vi.fn();
    render(<FinalPage data={soloData} onRevealNext={vi.fn()} onShowParticipantResults={onShow} />);

    revealAllIndividuals();

    expect(screen.getByText("1st Place")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "チーム結果を発表" })).not.toBeInTheDocument();
    // 個人戦は done 到達時に公開
    expect(onShow).toHaveBeenCalledTimes(1);
  });
});
