import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilePage } from "./ProfilePage";
import type { TeamInfo } from "../../types";

// capturedImageをテストごとに切り替え可能にする
let mockCapturedImage: string | null = null;

vi.mock("../../hooks/useCamera", () => ({
  useCamera: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    isActive: false,
    capturedImage: mockCapturedImage,
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    capture: vi.fn(),
    retake: vi.fn(),
    error: null,
    isSupported: true,
  }),
}));

describe("ProfilePage", () => {
  it("ニックネーム未入力で参加ボタンが無効", () => {
    mockCapturedImage = "data:image/png;base64,test";
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("ニックネーム+同意ありで参加ボタンが有効（自撮りなし）", async () => {
    mockCapturedImage = null;
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("checkbox"));
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeEnabled();
  });

  it("同意なしでは参加ボタンが無効", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("参加ボタンクリックでonJoinが呼ばれる", async () => {
    mockCapturedImage = "data:image/png;base64,selfie";
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "太郎");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "参加する" }));

    expect(handleJoin).toHaveBeenCalledWith("太郎", "data:image/png;base64,selfie", undefined);
  });

  it("Enterキーでもフォーム送信される", async () => {
    mockCapturedImage = "data:image/png;base64,selfie";
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} />);

    await user.click(screen.getByRole("checkbox"));
    const input = screen.getByLabelText(/ニックネーム/);
    await user.type(input, "花子");
    await user.keyboard("{Enter}");

    expect(handleJoin).toHaveBeenCalledWith("花子", "data:image/png;base64,selfie", undefined);
  });

  it("isJoining=trueで参加ボタンが無効になり「参加中…」と表示される", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={true} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加中…" });

    expect(button).toBeDisabled();
  });

  it("isJoining=trueの間はonJoinが呼ばれない", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={true} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("button", { name: "参加中…" }));

    expect(handleJoin).not.toHaveBeenCalled();
  });

  it("ニックネームが8文字に制限される", async () => {
    mockCapturedImage = null;
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    const input = screen.getByLabelText(/ニックネーム/);
    await user.type(input, "あいうえおかきくけこ");

    expect(input).toHaveValue("あいうえおかきく");
  });

  it("空白のみのニックネームでは参加ボタンが無効", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "   ");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("アイコンを撮るボタンが表示される", () => {
    mockCapturedImage = null;
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    expect(screen.getByText("アイコンを撮る")).toBeInTheDocument();
  });
});

describe("ProfilePage チーム選択", () => {
  const mockTeams: TeamInfo[] = [
    { id: 1, name: "A", orderIndex: 0 },
    { id: 2, name: "B", orderIndex: 1 },
    { id: 3, name: "C", orderIndex: 2 },
    { id: 4, name: "D", orderIndex: 3 },
  ];

  it("teamsがある場合にチーム選択ボタンが表示される", () => {
    mockCapturedImage = null;
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} teams={mockTeams} />);

    expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "D" })).toBeInTheDocument();
  });

  it("チーム未選択では参加ボタンが無効", async () => {
    mockCapturedImage = null;
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} teams={mockTeams} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("button", { name: "参加する" })).toBeDisabled();
  });

  it("チーム選択後に参加ボタンが有効", async () => {
    mockCapturedImage = null;
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} teams={mockTeams} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "A" }));

    expect(screen.getByRole("button", { name: "参加する" })).toBeEnabled();
  });

  it("チーム選択でonJoinにteamIdが渡される", async () => {
    mockCapturedImage = null;
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} teams={mockTeams} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "B" }));
    await user.click(screen.getByRole("button", { name: "参加する" }));

    expect(handleJoin).toHaveBeenCalledWith("テスト", undefined, 2);
  });
});
