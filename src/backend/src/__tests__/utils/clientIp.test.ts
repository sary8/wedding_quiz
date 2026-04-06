import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("clientIp", () => {
  const originalEnv = process.env.TRUSTED_PROXY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TRUSTED_PROXY;
    } else {
      process.env.TRUSTED_PROXY = originalEnv;
    }
    vi.resetModules();
  });

  describe("getClientIp (Hono)", () => {
    function createMockContext(headers: Record<string, string | undefined>) {
      return {
        req: {
          header: (name: string) => headers[name.toLowerCase()],
        },
      } as unknown as import("hono").Context;
    }

    it("TRUSTED_PROXY=true + x-forwarded-for あり → 最初のIPを返す", async () => {
      process.env.TRUSTED_PROXY = "true";
      const { getClientIp } = await import("../../utils/clientIp.js");
      const c = createMockContext({ "x-forwarded-for": "203.0.113.1" });
      expect(getClientIp(c)).toBe("203.0.113.1");
    });

    it("TRUSTED_PROXY=true + 複数IP → 最初のIPを返す", async () => {
      process.env.TRUSTED_PROXY = "true";
      const { getClientIp } = await import("../../utils/clientIp.js");
      const c = createMockContext({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 172.16.0.1" });
      expect(getClientIp(c)).toBe("203.0.113.1");
    });

    it("TRUSTED_PROXY=true + x-forwarded-for なし → unknown フォールバック", async () => {
      process.env.TRUSTED_PROXY = "true";
      const { getClientIp } = await import("../../utils/clientIp.js");
      const c = createMockContext({});
      expect(getClientIp(c)).toBe("unknown");
    });

    it("TRUSTED_PROXY未設定 + x-forwarded-for あり → IP偽装防止のため無視してunknown", async () => {
      delete process.env.TRUSTED_PROXY;
      const { getClientIp } = await import("../../utils/clientIp.js");
      const c = createMockContext({ "x-forwarded-for": "203.0.113.1" });
      expect(getClientIp(c)).toBe("unknown");
    });

    it("TRUSTED_PROXY未設定 + ヘッダなし → unknown", async () => {
      delete process.env.TRUSTED_PROXY;
      const { getClientIp } = await import("../../utils/clientIp.js");
      const c = createMockContext({});
      expect(getClientIp(c)).toBe("unknown");
    });
  });

  describe("getSocketClientIp (Socket.io)", () => {
    function createMockSocket(address: string, headers: Record<string, string | undefined>) {
      return {
        handshake: {
          address,
          headers,
        },
      } as unknown as import("socket.io").Socket;
    }

    it("TRUSTED_PROXY=true + x-forwarded-for あり → 最初のIPを返す", async () => {
      process.env.TRUSTED_PROXY = "true";
      const { getSocketClientIp } = await import("../../utils/clientIp.js");
      const socket = createMockSocket("127.0.0.1", { "x-forwarded-for": "203.0.113.1" });
      expect(getSocketClientIp(socket)).toBe("203.0.113.1");
    });

    it("TRUSTED_PROXY=true + 複数IP → 最初のIPを返す", async () => {
      process.env.TRUSTED_PROXY = "true";
      const { getSocketClientIp } = await import("../../utils/clientIp.js");
      const socket = createMockSocket("127.0.0.1", { "x-forwarded-for": "203.0.113.1, 10.0.0.1" });
      expect(getSocketClientIp(socket)).toBe("203.0.113.1");
    });

    it("TRUSTED_PROXY=true + x-forwarded-for なし → リモートアドレスフォールバック", async () => {
      process.env.TRUSTED_PROXY = "true";
      const { getSocketClientIp } = await import("../../utils/clientIp.js");
      const socket = createMockSocket("192.168.1.1", {});
      expect(getSocketClientIp(socket)).toBe("192.168.1.1");
    });

    it("TRUSTED_PROXY未設定 → リモートアドレスを使用", async () => {
      delete process.env.TRUSTED_PROXY;
      const { getSocketClientIp } = await import("../../utils/clientIp.js");
      const socket = createMockSocket("192.168.1.1", { "x-forwarded-for": "203.0.113.1" });
      expect(getSocketClientIp(socket)).toBe("192.168.1.1");
    });

    it("リモートアドレスなし → unknown", async () => {
      delete process.env.TRUSTED_PROXY;
      const { getSocketClientIp } = await import("../../utils/clientIp.js");
      const socket = createMockSocket("", {});
      expect(getSocketClientIp(socket)).toBe("unknown");
    });
  });
});
