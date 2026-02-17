import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilePage } from "./ProfilePage";

// useCameraをモック（カメラAPIに依存しないようにする）
vi.mock("../../hooks/useCamera", () => ({
  useCamera: () => ({
    videoRef: { current: null },
    canvasRef: { current: null },
    isActive: false,
    capturedImage: null,
    selectedFrame: "none" as const,
    setSelectedFrame: vi.fn(),
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    capture: vi.fn(),
    retake: vi.fn(),
    error: null,
    isSupported: true,
    frameOptions: [
      { type: "none" as const, label: "フレームなし" },
      { type: "heart" as const, label: "ハート&花" },
    ],
  }),
}));

describe("ProfilePage", () => {
  it("ニックネーム未入力で参加ボタンが無効", () => {
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("ニックネーム入力で参加ボタンが有効になる", async () => {
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeEnabled();
  });

  it("参加ボタンクリックでonJoinが呼ばれる", async () => {
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "太郎");
    await user.click(screen.getByRole("button", { name: "参加する" }));

    expect(handleJoin).toHaveBeenCalledWith("太郎", undefined);
  });

  it("Enterキーでもフォーム送信される", async () => {
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} />);

    const input = screen.getByLabelText(/ニックネーム/);
    await user.type(input, "花子");
    await user.keyboard("{Enter}");

    expect(handleJoin).toHaveBeenCalledWith("花子", undefined);
  });

  it("isJoining=trueで参加ボタンが無効になり「参加中...」と表示される", async () => {
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={true} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加中..." });

    expect(button).toBeDisabled();
  });

  it("isJoining=trueの間はonJoinが呼ばれない", async () => {
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={true} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("button", { name: "参加中..." }));

    expect(handleJoin).not.toHaveBeenCalled();
  });

  it("ニックネームが20文字に制限される", async () => {
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    const input = screen.getByLabelText(/ニックネーム/);
    await user.type(input, "あいうえおかきくけこさしすせそたちつてとな");

    expect(input).toHaveValue("あいうえおかきくけこさしすせそたちつてと");
  });

  it("空白のみのニックネームでは参加ボタンが無効", async () => {
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "   ");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("自撮りを撮るボタンが表示される", () => {
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    expect(screen.getByText("自撮りを撮る")).toBeInTheDocument();
  });
});
