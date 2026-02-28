import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { clearAllSessions, createSession } from "../../services/authService.js";
import { authRoutes } from "../../routes/auth.js";

describe("auth routes", () => {
  beforeEach(() => {
    clearAllSessions();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("POST /session", () => {
    it("PIN未設定 → トークン発行 (201)", async () => {
      delete process.env.ADMIN_PIN;

      const res = await authRoutes.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.token).toBeTruthy();
      expect(data.token.length).toBe(32);
    });

    it("PIN設定 + 正しいPIN → トークン発行 (201)", async () => {
      vi.stubEnv("ADMIN_PIN", "9876");

      const res = await authRoutes.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "9876" }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.token).toBeTruthy();
    });

    it("PIN設定 + 間違ったPIN → 401", async () => {
      vi.stubEnv("ADMIN_PIN", "9876");

      const res = await authRoutes.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "wrong" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("PIN");
    });

    it("PIN設定 + PIN未送信 → 401", async () => {
      vi.stubEnv("ADMIN_PIN", "9876");

      const res = await authRoutes.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /pin-required", () => {
    it("ADMIN_PIN未設定 → required: false", async () => {
      delete process.env.ADMIN_PIN;
      const res = await authRoutes.request("/pin-required", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.required).toBe(false);
    });

    it("ADMIN_PIN設定 → required: true", async () => {
      vi.stubEnv("ADMIN_PIN", "1234");
      const res = await authRoutes.request("/pin-required", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.required).toBe(true);
    });
  });

  describe("GET /status", () => {
    it("Authorizationヘッダなし → authenticated: false", async () => {
      const res = await authRoutes.request("/status", { method: "GET" });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
    });

    it("無効なトークン → authenticated: false", async () => {
      const res = await authRoutes.request("/status", {
        method: "GET",
        headers: { Authorization: "Bearer invalid-token" },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
    });

    it("有効なトークン → authenticated: true", async () => {
      const token = createSession();

      const res = await authRoutes.request("/status", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
    });
  });
});
