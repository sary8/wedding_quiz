import { dirname } from "path";

// DB接続設定の解決。DATABASE_URL 未設定ならローカルSQLiteファイル。
// Turso 等のリモート libsql を使う場合は DATABASE_URL=libsql://... と
// DATABASE_AUTH_TOKEN を設定する（drizzle.config.ts も同じ規約を参照）。
export const DEFAULT_DB_URL = "file:./data/wedding_quiz.db";

export interface DbConfig {
  url: string;
  authToken?: string;
}

export function resolveDbConfig(env: Record<string, string | undefined>): DbConfig {
  const url = env.DATABASE_URL?.trim() || DEFAULT_DB_URL;
  const authToken = env.DATABASE_AUTH_TOKEN?.trim();
  return authToken ? { url, authToken } : { url };
}

export function isFileUrl(url: string): boolean {
  return url.startsWith("file:");
}

// file: URL のときにローカルへ作成すべきディレクトリを返す（:memory: やリモートURLは null）
export function localDataDir(url: string): string | null {
  if (!isFileUrl(url) || url.includes(":memory:")) return null;
  const dir = dirname(url.slice("file:".length));
  return dir === "." ? null : dir;
}
