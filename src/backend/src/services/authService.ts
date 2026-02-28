import { nanoid } from "nanoid";

type Session = {
  token: string;
  createdAt: number;
  lastAccessedAt: number;
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const SESSION_IDLE_MS = 4 * 60 * 60 * 1000; // 4時間アイドルタイムアウト
const MAX_SESSIONS = 10;

const sessions = new Map<string, Session>();

// 定期クリーンアップ（期限切れセッション削除）
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (isExpired(session, now)) {
      sessions.delete(token);
    }
  }
}, 60_000);

// テスト時にタイマーリーク防止
if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
  cleanupInterval.unref();
}

function isExpired(session: Session, now: number): boolean {
  return (
    now - session.createdAt > SESSION_TTL_MS ||
    now - session.lastAccessedAt > SESSION_IDLE_MS
  );
}

export function createSession(): string {
  // 最大セッション数制限: 古いものから削除
  if (sessions.size >= MAX_SESSIONS) {
    let oldestToken: string | null = null;
    let oldestTime = Infinity;
    for (const [token, session] of sessions) {
      if (session.lastAccessedAt < oldestTime) {
        oldestTime = session.lastAccessedAt;
        oldestToken = token;
      }
    }
    if (oldestToken) sessions.delete(oldestToken);
  }

  const token = nanoid(32);
  const now = Date.now();
  sessions.set(token, {
    token,
    createdAt: now,
    lastAccessedAt: now,
  });
  return token;
}

export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;

  const now = Date.now();
  if (isExpired(session, now)) {
    sessions.delete(token);
    return false;
  }

  // アクセス時刻を更新
  session.lastAccessedAt = now;
  return true;
}

export function verifyAdminPin(pin: string): boolean {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) return true; // PIN未設定の場合は常に成功
  return pin === adminPin;
}

export function revokeSession(token: string): boolean {
  return sessions.delete(token);
}

export function getSessionCount(): number {
  return sessions.size;
}

// テスト用: 全セッションクリア
export function clearAllSessions(): void {
  sessions.clear();
}
