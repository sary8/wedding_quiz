import { Hono } from "hono";

export const quizRoutes = new Hono();

// TODO: 次タスクで実装
quizRoutes.get("/", (c) => c.json({ message: "quiz routes" }));
