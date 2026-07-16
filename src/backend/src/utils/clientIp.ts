import type { Context } from "hono";
import type { Socket } from "socket.io";

const isTrustedProxy = process.env.TRUSTED_PROXY === "true";
// 信頼するリバースプロキシの段数。X-Forwarded-For の「右端から数えてこの位置」を
// 実クライアントIPとして採用する。右端はプロキシが付与した検証済みの接続元IPで、
// 最左端はクライアントが自由に詐称できるため使わない（レート制限バイパス対策 H-1）。
// Render 等の多くの PaaS は1段（デフォルト）。多段構成では実段数を設定する。
const TRUSTED_PROXY_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

// X-Forwarded-For から実クライアントIPを抽出する。右端から TRUSTED_PROXY_HOPS 番目。
function extractForwardedIp(forwarded: string): string | null {
  const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  if (ips.length === 0) return null;
  const idx = ips.length - TRUSTED_PROXY_HOPS;
  return ips[idx >= 0 ? idx : 0];
}

/** Hono Context からクライアントIPを取得 */
export function getClientIp(c: Context): string {
  if (isTrustedProxy) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const ip = extractForwardedIp(forwarded);
      if (ip) return ip;
    }
  }
  // @hono/node-server 直結時は Node のソケットからリモートアドレスを取得。
  // これがないと全クライアントが "unknown" の単一バケットでレート制限される
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  return incoming?.socket?.remoteAddress || "unknown";
}

/** Socket.io Socket からクライアントIPを取得 */
export function getSocketClientIp(socket: Socket): string {
  if (isTrustedProxy) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    if (forwarded) {
      const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const ip = extractForwardedIp(value);
      if (ip) return ip;
    }
  }
  return socket.handshake.address || "unknown";
}
