import { Hono } from "hono";
import { createSession, validateSession, verifyAdminPin } from "../services/authService.js";

export const authRoutes = new Hono();

// セッショントークン発行
authRoutes.post("/session", async (c) => {
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
