import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../../utils/logger.js";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("info", () => {
    it("メッセージのみ出力", () => {
      logger.info("server started");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "[2026-01-15T12:30:00.000Z][INFO] server started"
      );
    });

    it("コンテキスト付き出力", () => {
      logger.info("participant joined", { roomCode: "ABC123", participantId: 5 });
      expect(logSpy).toHaveBeenCalledWith(
        '[2026-01-15T12:30:00.000Z][INFO] participant joined {"roomCode":"ABC123","participantId":5}'
      );
    });

    it("空コンテキストはJSON出力しない", () => {
      logger.info("test", {});
      expect(logSpy).toHaveBeenCalledWith(
        "[2026-01-15T12:30:00.000Z][INFO] test"
      );
    });

    it("console.logを使用する", () => {
      logger.info("msg");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    it("WARNレベルで出力", () => {
      logger.warn("validation failed", { roomCode: "XYZ789" });
      expect(logSpy).toHaveBeenCalledWith(
        '[2026-01-15T12:30:00.000Z][WARN] validation failed {"roomCode":"XYZ789"}'
      );
    });

    it("console.logを使用する", () => {
      logger.warn("msg");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("ERRORレベルで出力", () => {
      logger.error("db connection failed", { error: "ECONNREFUSED" });
      expect(errorSpy).toHaveBeenCalledWith(
        '[2026-01-15T12:30:00.000Z][ERROR] db connection failed {"error":"ECONNREFUSED"}'
      );
    });

    it("console.errorを使用する", () => {
      logger.error("msg");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("メッセージのみでも動作する", () => {
      logger.error("unknown error");
      expect(errorSpy).toHaveBeenCalledWith(
        "[2026-01-15T12:30:00.000Z][ERROR] unknown error"
      );
    });
  });
});
