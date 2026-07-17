import { defineConfig } from "drizzle-kit";
// src/backend/.env があれば読み込む（Turso の URL/トークンをチャットやシェル履歴に
// 出さずに渡すため）。既に設定済みの環境変数が優先され、ファイルが無ければ何もしない
import "dotenv/config";

// src/db/config.ts と同じ規約: DATABASE_URL 未設定ならローカルSQLiteファイル。
// Turso にマイグレーションを適用する場合は src/backend/.env に
// DATABASE_URL / DATABASE_AUTH_TOKEN を書いて npm run db:migrate
const url = process.env.DATABASE_URL?.trim() || "file:./data/wedding_quiz.db";
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim();

export default defineConfig(
  url.startsWith("file:")
    ? {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: { url },
      }
    : {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: { url, authToken },
      }
);
