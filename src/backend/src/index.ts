import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Server as SocketIOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/index.js";
import { quizRoutes } from "./routes/quiz.js";
import { questionRoutes } from "./routes/question.js";
import { mediaRoutes } from "./routes/media.js";
import { setupQuizSocket } from "./socket/quizHandler.js";

const app = new Hono();

// CORS（環境変数 CORS_ORIGIN で本番ドメインを指定可能）
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174,https://localhost:5174,https://localhost:5175,https://localhost:5176")
  .split(",")
  .map((s) => s.trim());

app.use(
  "/api/*",
  cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// グローバルエラーハンドラ
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "サーバー内部エラーが発生しました" }, 500);
});

// REST API routes
app.route("/api/quizzes", quizRoutes);
app.route("/api/questions", questionRoutes);
app.route("/api/media", mediaRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Start HTTP server
const PORT = Number(process.env.PORT) || 3001;
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Backend running on http://localhost:${info.port}`);
});

// Attach Socket.io
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});

setupQuizSocket(io);

console.log("Socket.io attached");
