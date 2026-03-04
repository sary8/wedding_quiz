import { Hono } from "hono";
import { createSession, validateSession, verifyAdminPin } from "../services/authService.js";
import { getClientIp } from "../utils/clientIp.js";

export const authRoutes = new Hono();

// 認証エンドポイント用レート制限（IP単位）
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000; // 1分
const AUTH_RATE_LIMIT_MAX = 5; // 1分あたり最大5回
const authRateMap = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authRateMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    authRateMap.set(ip, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= AUTH_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// 定期クリーンアップ
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authRateMap) {
    if (now >= entry.resetAt) authRateMap.delete(ip);
  }
}, 60_000);

if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
  cleanupInterval.unref();
}

// セッショントークン発行
authRoutes.post("/session", async (c) => {
  const ip = getClientIp(c);
  if (!checkAuthRateLimit(ip)) {
    return c.json({ error: "試行回数が多すぎます。しばらくしてから再試行してください" }, 429);
  }

  const body = await c.req.json<{ pin?: string }>().catch(() => ({}));

  // PIN認証（ADMIN_PIN設定時のみ）
  const pin = (body as { pin?: string }).pin ?? "";
  if (!verifyAdminPin(pin)) {
    return c.json({ error: "PINが正しくありません" }, 401);
  }

  const token = createSession();
  return c.json({ token }, 201);
});

// PIN要否確認
authRoutes.get("/pin-required", (c) => {
  return c.json({ required: !!process.env.ADMIN_PIN });
});

// セッション状態確認
authRoutes.get("/status", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ authenticated: false });
  }

  const token = authHeader.slice(7);
  const valid = validateSession(token);
  return c.json({ authenticated: valid });
});
