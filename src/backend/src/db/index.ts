import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { mkdirSync } from "fs";
import { resolveDbConfig, isFileUrl, localDataDir } from "./config.js";

const dbConfig = resolveDbConfig(process.env);

const dataDir = localDataDir(dbConfig.url);
if (dataDir) {
  mkdirSync(dataDir, { recursive: true });
}

const client = createClient(dbConfig);

// libsql は接続ごとに foreign_keys がデフォルトOFF（Turso Cloud も同様）のため明示的に有効化する。
// ただしリモート接続では再接続時にセッション設定が失われ得るため、FK はローカル開発時の安全網。
// カスケード削除は各削除処理が明示的に行う（2026-07-17 Turso移行を参照）。
await client.execute("PRAGMA foreign_keys = ON");

if (isFileUrl(dbConfig.url)) {
  // 書き込み並行性の確保（H-2）: WAL で読み取りと書き込みの相互ブロックを避け、
  // busy_timeout で締切間際の一斉回答時の SQLITE_BUSY 即時失敗を防ぐ。
  // Turso（リモート）はサーバー側が並行性・ジャーナルを管理しており、
  // これらの PRAGMA は非サポートのためローカルファイルDBのときだけ実行する。
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
}

export const db = drizzle(client, { schema });
export { schema };
