import { defineConfig } from "drizzle-kit";

// src/db/config.ts と同じ規約: DATABASE_URL 未設定ならローカルSQLiteファイル。
// Turso にマイグレーションを適用する場合:
//   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate
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
