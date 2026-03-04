import type { Context } from "hono";
import type { Socket } from "socket.io";

const isTrustedProxy = process.env.TRUSTED_PROXY === "true";

/** Hono Context からクライアントIPを取得 */
export function getClientIp(c: Context): string {
  if (isTrustedProxy) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
  }
  // Hono の ConnInfo が使えない場合は unknown
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Socket.io Socket からクライアントIPを取得 */
export function getSocketClientIp(socket: Socket): string {
  if (isTrustedProxy) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    if (forwarded) {
      const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return value.split(",")[0].trim();
    }
  }
  return socket.handshake.address || "unknown";
}
