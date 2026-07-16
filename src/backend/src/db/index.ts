import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { mkdirSync } from "fs";

const DB_PATH = "./data/wedding_quiz.db";

mkdirSync("./data", { recursive: true });

const client = createClient({
  url: `file:${DB_PATH}`,
});

// libsql は接続ごとに foreign_keys がデフォルトOFFのため明示的に有効化する。
// これがないと onDelete: "cascade" / "set null" が一切効かず、
// クイズ削除時に questions / participants / answers が孤児化する。
await client.execute("PRAGMA foreign_keys = ON");
// 書き込み並行性の確保（H-2）: WAL で読み取りと書き込みの相互ブロックを避け、
// busy_timeout で締切間際の一斉回答時の SQLITE_BUSY 即時失敗を防ぐ。
await client.execute("PRAGMA journal_mode = WAL");
await client.execute("PRAGMA busy_timeout = 5000");

export const db = drizzle(client, { schema });
export { schema };
