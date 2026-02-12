import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/index.js";

type QuizIO = Server<ClientToServerEvents, ServerToClientEvents>;

export function setupQuizSocket(io: QuizIO) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // TODO: 次タスクで各イベントハンドラを実装

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
