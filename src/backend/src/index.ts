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

// CORS
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
  })
);

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
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

setupQuizSocket(io);

console.log("Socket.io attached");
