import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createSession,
  validateSession,
  verifyAdminPin,
  revokeSession,
  getSessionCount,
  clearAllSessions,
} from "../../services/authService.js";

describe("authService", () => {
  beforeEach(() => {
    clearAllSessions();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createSession", () => {
    it("トークンを発行し、validateSessionで検証できる", () => {
      const token = createSession();
      expect(token).toBeTruthy();
      expect(token.length).toBe(32);
      expect(validateSession(token)).toBe(true);
    });

    it("毎回異なるトークンを発行する", () => {
      const t1 = createSession();
      const t2 = createSession();
      expect(t1).not.toBe(t2);
    });

    it("最大セッション数を超えると古いものが削除される", () => {
      const tokens: string[] = [];
      for (let i = 0; i < 11; i++) {
        tokens.push(createSession());
      }
      expect(getSessionCount()).toBe(10);
      // 最初のトークンは削除されている
      expect(validateSession(tokens[0])).toBe(false);
      // 最新のトークンは有効
      expect(validateSession(tokens[10])).toBe(true);
    });
  });

  describe("validateSession", () => {
    it("存在しないトークン → false", () => {
      expect(validateSession("nonexistent-token")).toBe(false);
    });

    it("有効なトークン → true", () => {
      const token = createSession();
      expect(validateSession(token)).toBe(true);
    });

    it("TTL超過 → false", () => {
      const token = createSession();
      // 25時間後にシミュレート
      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      expect(validateSession(token)).toBe(false);
      vi.useRealTimers();
    });

    it("アイドルタイムアウト超過 → false", () => {
      const token = createSession();
      vi.useFakeTimers();
      vi.advanceTimersByTime(5 * 60 * 60 * 1000); // 5時間
      expect(validateSession(token)).toBe(false);
      vi.useRealTimers();
    });

    it("定期アクセスでアイドルタイムアウトをリセット", () => {
      vi.useFakeTimers();
      const token = createSession();

      // 3時間後にアクセス → リセット
      vi.advanceTimersByTime(3 * 60 * 60 * 1000);
      expect(validateSession(token)).toBe(true);

      // さらに3時間後にアクセス → まだ有効（アイドルリセット済み）
      vi.advanceTimersByTime(3 * 60 * 60 * 1000);
      expect(validateSession(token)).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("verifyAdminPin", () => {
    it("ADMIN_PIN未設定 → 常にtrue", () => {
      delete process.env.ADMIN_PIN;
      expect(verifyAdminPin("")).toBe(true);
      expect(verifyAdminPin("anything")).toBe(true);
    });

    it("ADMIN_PIN設定 → 正しいPINでtrue", () => {
      vi.stubEnv("ADMIN_PIN", "1234");
      expect(verifyAdminPin("1234")).toBe(true);
    });

    it("ADMIN_PIN設定 → 間違ったPINでfalse", () => {
      vi.stubEnv("ADMIN_PIN", "1234");
      expect(verifyAdminPin("wrong")).toBe(false);
      expect(verifyAdminPin("")).toBe(false);
    });
  });

  describe("revokeSession", () => {
    it("有効なトークンを無効化 → true", () => {
      const token = createSession();
      expect(revokeSession(token)).toBe(true);
      expect(validateSession(token)).toBe(false);
    });

    it("存在しないトークン → false", () => {
      expect(revokeSession("nonexistent")).toBe(false);
    });
  });

  describe("clearAllSessions", () => {
    it("全セッションをクリア", () => {
      createSession();
      createSession();
      expect(getSessionCount()).toBe(2);
      clearAllSessions();
      expect(getSessionCount()).toBe(0);
    });
  });
});
