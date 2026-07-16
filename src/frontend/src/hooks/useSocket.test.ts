import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSocket } from "./useSocket";

// socket.io-client のモック
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();
const mockTimeout = vi.fn(() => ({ emit: mockEmit }));

let connectHandler: (() => void) | null = null;
let disconnectHandler: (() => void) | null = null;
let connectErrorHandler: ((err: Error) => void) | null = null;

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === "connect") connectHandler = handler as () => void;
      if (event === "disconnect") disconnectHandler = handler as () => void;
      if (event === "connect_error") connectErrorHandler = handler as (err: Error) => void;
      mockOn(event, handler);
    }),
    off: mockOff,
    emit: mockEmit,
    disconnect: mockDisconnect,
    timeout: mockTimeout,
  })),
}));

describe("useSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectHandler = null;
    disconnectHandler = null;
    connectErrorHandler = null;
  });

  it("初期状態で isConnected=false, connectionError=null", () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionError).toBeNull();
  });

  it("connect イベントで isConnected=true になる", () => {
    const { result } = renderHook(() => useSocket());
    act(() => {
      connectHandler?.();
    });
    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionError).toBeNull();
  });

  it("disconnect イベントで isConnected=false になる", () => {
    const { result } = renderHook(() => useSocket());
    act(() => {
      connectHandler?.();
    });
    expect(result.current.isConnected).toBe(true);
    act(() => {
      disconnectHandler?.();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("connect_error で connectionError がセットされる", () => {
    const { result } = renderHook(() => useSocket());
    act(() => {
      connectErrorHandler?.(new Error("test error"));
    });
    expect(result.current.connectionError).toBe("接続エラー: test error");
  });

  it("emit がソケットの emit に委譲される", () => {
    const { result } = renderHook(() => useSocket());
    const cb = vi.fn();
    result.current.emit("joinRoom", { roomCode: "123456", nickname: "test" }, cb);
    expect(mockEmit).toHaveBeenCalled();
  });

  it("emitWithTimeout がタイムアウト時にエラーコールバックを呼ぶ（C-2対策）", () => {
    const { result } = renderHook(() => useSocket());
    const cb = vi.fn();
    result.current.emitWithTimeout("nextQuestion", { roomCode: "123456", hostSecret: "s" }, cb);
    expect(mockTimeout).toHaveBeenCalledWith(10000);
    // socket.timeout().emit に渡された内部コールバックを取り出して発火
    const internalCb = mockEmit.mock.calls.at(-1)?.[2] as (err: Error | null, res: unknown) => void;
    act(() => internalCb(new Error("timeout"), undefined));
    expect(cb).toHaveBeenCalledWith({ success: false, error: "サーバーからの応答がタイムアウトしました" });
  });

  it("emitWithTimeout が成功時にサーバー応答をそのまま渡す", () => {
    const { result } = renderHook(() => useSocket());
    const cb = vi.fn();
    result.current.emitWithTimeout("nextQuestion", { roomCode: "123456", hostSecret: "s" }, cb);
    const internalCb = mockEmit.mock.calls.at(-1)?.[2] as (err: Error | null, res: unknown) => void;
    act(() => internalCb(null, { success: true }));
    expect(cb).toHaveBeenCalledWith({ success: true });
  });

  it("on が登録解除関数を返す", () => {
    const { result } = renderHook(() => useSocket());
    const handler = vi.fn();
    const unsubscribe = result.current.on("gameStarted", handler);
    expect(mockOn).toHaveBeenCalledWith("gameStarted", handler);
    expect(typeof unsubscribe).toBe("function");
  });

  it("アンマウント時に disconnect が呼ばれる", () => {
    const { unmount } = renderHook(() => useSocket());
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
