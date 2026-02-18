import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilePage } from "./ProfilePage";

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

  it("ニックネームのみ（自撮りなし）では参加ボタンが無効", async () => {
    mockCapturedImage = null;
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("ニックネーム+自撮りで参加ボタンが有効になる", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeEnabled();
  });

  it("参加ボタンクリックでonJoinが呼ばれる", async () => {
    mockCapturedImage = "data:image/png;base64,selfie";
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "太郎");
    await user.click(screen.getByRole("button", { name: "参加する" }));

    expect(handleJoin).toHaveBeenCalledWith("太郎", "data:image/png;base64,selfie");
  });

  it("Enterキーでもフォーム送信される", async () => {
    mockCapturedImage = "data:image/png;base64,selfie";
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={false} />);

    const input = screen.getByLabelText(/ニックネーム/);
    await user.type(input, "花子");
    await user.keyboard("{Enter}");

    expect(handleJoin).toHaveBeenCalledWith("花子", "data:image/png;base64,selfie");
  });

  it("isJoining=trueで参加ボタンが無効になり「参加中...」と表示される", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={true} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    const button = screen.getByRole("button", { name: "参加中..." });

    expect(button).toBeDisabled();
  });

  it("isJoining=trueの間はonJoinが呼ばれない", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const handleJoin = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePage onJoin={handleJoin} isJoining={true} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "テスト");
    await user.click(screen.getByRole("button", { name: "参加中..." }));

    expect(handleJoin).not.toHaveBeenCalled();
  });

  it("ニックネームが20文字に制限される", async () => {
    mockCapturedImage = null;
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    const input = screen.getByLabelText(/ニックネーム/);
    await user.type(input, "あいうえおかきくけこさしすせそたちつてとな");

    expect(input).toHaveValue("あいうえおかきくけこさしすせそたちつてと");
  });

  it("空白のみのニックネームでは参加ボタンが無効", async () => {
    mockCapturedImage = "data:image/png;base64,test";
    const user = userEvent.setup();
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    await user.type(screen.getByLabelText(/ニックネーム/), "   ");
    const button = screen.getByRole("button", { name: "参加する" });

    expect(button).toBeDisabled();
  });

  it("自撮りを撮るボタンが表示される", () => {
    mockCapturedImage = null;
    render(<ProfilePage onJoin={vi.fn()} isJoining={false} />);

    expect(screen.getByText("自撮りを撮る")).toBeInTheDocument();
  });
});
