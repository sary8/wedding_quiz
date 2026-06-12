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

export const db = drizzle(client, { schema });
export { schema };
