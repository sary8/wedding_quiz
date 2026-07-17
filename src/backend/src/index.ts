import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { Server as SocketIOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/index.js";
import { quizRoutes, participantRoutes } from "./routes/quiz.js";
import { questionRoutes } from "./routes/question.js";
import { mediaRoutes } from "./routes/media.js";
import { questionBankRoutes } from "./routes/questionBank.js";
import { authRoutes } from "./routes/auth.js";
import { setupQuizSocket } from "./socket/quizHandler.js";
import { logger } from "./utils/logger.js";
import { validateSession } from "./services/authService.js";
import { startCleanupScheduler } from "./services/cleanupService.js";
import { resolveDbConfig, isFileUrl } from "./db/config.js";

const app = new Hono();

// H1: CORS fail-closed（本番で CORS_ORIGIN 未設定なら起動拒否）
if (!process.env.CORS_ORIGIN && process.env.NODE_ENV === "production") {
  logger.error("CORS_ORIGIN が未設定です。本番環境では必須です");
  process.exit(1);
}
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174,https://localhost:5174,https://localhost:5175,https://localhost:5176")
  .split(",")
  .map((s) => s.trim());

// H3: セキュリティヘッダ（全ルート）+ CSP（L-4: 将来のXSS/依存汚染に対する多層防御）
app.use(
  secureHeaders({
    // 既定の Cross-Origin-Resource-Policy: same-origin は、SWA（別オリジン）上の
    // <img> によるメディア埋め込みをブラウザがブロックしてしまうため無効化する。
    // メディア配信ルートが明示的に cross-origin を付与する（2026-07-17 メディアURL issue 追補）
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  })
);

// M4: ボディサイズ制限（media用 10MB → その他 1MB の順で登録）
app.use(
  "/api/media/*",
  bodyLimit({
    maxSize: 10 * 1024 * 1024,
    onError: (c) => c.json({ error: "リクエストサイズが上限（10MB）を超えています" }, 413),
  })
);
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 1 * 1024 * 1024,
    onError: (c) => c.json({ error: "リクエストサイズが上限（1MB）を超えています" }, 413),
  })
);

// CORS
app.use(
  "/api/*",
  cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization", "X-Participant-Token"],
  })
);

// リクエストログ
app.use("/api/*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info(`${c.req.method} ${c.req.path} ${c.res.status}`, { ms });
});

// 公開ルート判定
function isPublicRoute(method: string, path: string): boolean {
  // Health check
  if (path === "/api/health") return true;

  // Auth endpoints
  if (path.startsWith("/api/auth/")) return true;

  // 参加者用: チーム選択情報取得
  if (method === "GET" && /^\/api\/quizzes\/room\/[^/]+\/info$/.test(path)) return true;

  // 参加者用: 自撮りアップロード
  if (method === "POST" && path === "/api/media/selfie") return true;

  // 参加者用: 自身のデータ削除（本人性は X-Participant-Token で担保）
  if (method === "DELETE" && path === "/api/quizzes/participants/me") return true;

  // メディア配信
  if (method === "GET" && /^\/api\/media\/[^/]+$/.test(path)) return true;

  return false;
}

// Admin認証ミドルウェア
app.use("/api/*", async (c, next) => {
  if (isPublicRoute(c.req.method, c.req.path)) {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  const token = authHeader.slice(7);
  if (!validateSession(token)) {
    return c.json({ error: "セッションが無効または期限切れです" }, 401);
  }

  return next();
});

// グローバルエラーハンドラ
app.onError((err, c) => {
  logger.error("unhandled error", { error: err.message, path: c.req.path });
  return c.json({ error: "サーバー内部エラーが発生しました" }, 500);
});

// REST API routes
app.route("/api/auth", authRoutes);
app.route("/api/quizzes", quizRoutes);
app.route("/api/participants", participantRoutes);
app.route("/api/questions", questionRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/question-bank", questionBankRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ADMIN_PIN未設定警告（production）
if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PIN) {
  logger.warn("ADMIN_PIN が未設定です。管理画面へのログインが拒否されます");
}

// TRUSTED_PROXY未設定警告（production）
// リバースプロキシ配下で未設定だと x-forwarded-for を読まず、
// 全クライアントが同一IPに見えてレート制限が共有バケット化する
if (process.env.NODE_ENV === "production" && process.env.TRUSTED_PROXY !== "true") {
  logger.warn(
    "TRUSTED_PROXY が未設定です。リバースプロキシ配下ではクライアントIPを判別できず、レート制限が全クライアント共有になります"
  );
}

// DATABASE_URL未設定警告（production）
// ローカルファイルSQLiteはコンテナ再起動でデータが消える。さらに App Service では
// /home（ネットワーク共有）上で WAL が動作しないため、本番は Turso 等のリモートDBを推奨
if (process.env.NODE_ENV === "production" && isFileUrl(resolveDbConfig(process.env).url)) {
  logger.warn(
    "DATABASE_URL が未設定（またはローカルファイルDB）です。データは再起動で失われる可能性があります"
  );
}

// Start HTTP server
const PORT = Number(process.env.PORT) || 3001;
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  logger.info(`backend running on http://localhost:${info.port}`);
});

// Attach Socket.io
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});

setupQuizSocket(io);
startCleanupScheduler();

logger.info("socket.io attached");

// グレースフルシャットダウン
function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  io.close();
  server.close(() => {
    logger.info("server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// 未捕捉例外の安全網。進行中ゲームの状態は in-memory のため、例外1つで
// プロセスを落とすと全roomが同時に失われる。ここではログのみ残して継続し、
// 原因究明の手がかりを確保する（根本対策は各ハンドラ・タイマーの try/catch）。
process.on("uncaughtException", (err) => {
  logger.error("uncaught exception", { error: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error("unhandled rejection", { error: message, stack });
});
