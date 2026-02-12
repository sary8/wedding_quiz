import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startTimer, stopTimer, getElapsedMs } from "../../services/timerService.js";

describe("timerService", () => {
  let mockNs: bigint;

  beforeEach(() => {
    vi.useFakeTimers();
    mockNs = BigInt(0);
    vi.spyOn(process.hrtime, "bigint").mockImplementation(() => mockNs);
  });

  afterEach(() => {
    stopTimer("test");
    stopTimer("test1");
    stopTimer("test2");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("startTimer", () => {
    it("onTickが即時発火（初回tick）", () => {
      const onTick = vi.fn();
      const onEnd = vi.fn();
      startTimer("test", 10, onTick, onEnd);
      expect(onTick).toHaveBeenCalledTimes(1);
      expect(onTick).toHaveBeenCalledWith(10);
    });

    it("1秒ごとにonTickが減少値で呼ばれる", () => {
      const onTick = vi.fn();
      const onEnd = vi.fn();
      startTimer("test", 3, onTick, onEnd);
      expect(onTick).toHaveBeenCalledWith(3);

      mockNs = BigInt(1_000_000_000);
      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledWith(2);

      mockNs = BigInt(2_000_000_000);
      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledWith(1);
    });

    it("時間満了でonEndが呼ばれる", () => {
      const onTick = vi.fn();
      const onEnd = vi.fn();
      startTimer("test", 2, onTick, onEnd);

      mockNs = BigInt(1_000_000_000);
      vi.advanceTimersByTime(1000);

      mockNs = BigInt(2_000_000_000);
      vi.advanceTimersByTime(1000);

      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("同じkeyで再開するとリセット", () => {
      const onTick1 = vi.fn();
      const onEnd1 = vi.fn();
      const onTick2 = vi.fn();
      const onEnd2 = vi.fn();

      startTimer("test", 10, onTick1, onEnd1);
      startTimer("test", 5, onTick2, onEnd2);

      // 1つ目のタイマーは破棄される
      mockNs = BigInt(5_000_000_000);
      vi.advanceTimersByTime(5000);

      expect(onEnd1).not.toHaveBeenCalled();
      expect(onEnd2).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopTimer", () => {
    it("実行中のタイマーが停止", () => {
      const onTick = vi.fn();
      const onEnd = vi.fn();
      startTimer("test", 5, onTick, onEnd);

      stopTimer("test");

      mockNs = BigInt(5_000_000_000);
      vi.advanceTimersByTime(5000);

      // initial tick のみ
      expect(onTick).toHaveBeenCalledTimes(1);
      expect(onEnd).not.toHaveBeenCalled();
    });

    it("存在しないkeyでもエラーにならない", () => {
      expect(() => stopTimer("nonexistent")).not.toThrow();
    });
  });

  describe("getElapsedMs", () => {
    it("実行中のタイマーの経過時間取得", () => {
      startTimer("test", 10, vi.fn(), vi.fn());
      mockNs = BigInt(2_500_000_000);
      expect(getElapsedMs("test")).toBeCloseTo(2500, 0);
    });

    it("存在しないkeyはnull", () => {
      expect(getElapsedMs("nonexistent")).toBeNull();
    });

    it("停止後はnull", () => {
      startTimer("test", 10, vi.fn(), vi.fn());
      stopTimer("test");
      expect(getElapsedMs("test")).toBeNull();
    });
  });

  it("複数タイマーの独立動作", () => {
    const onEnd1 = vi.fn();
    const onEnd2 = vi.fn();

    startTimer("test1", 2, vi.fn(), onEnd1);
    startTimer("test2", 4, vi.fn(), onEnd2);

    mockNs = BigInt(2_000_000_000);
    vi.advanceTimersByTime(2000);
    expect(onEnd1).toHaveBeenCalledTimes(1);
    expect(onEnd2).not.toHaveBeenCalled();

    mockNs = BigInt(4_000_000_000);
    vi.advanceTimersByTime(2000);
    expect(onEnd2).toHaveBeenCalledTimes(1);
  });
});
