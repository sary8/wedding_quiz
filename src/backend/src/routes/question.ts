import { Hono } from "hono";

export const questionRoutes = new Hono();

// TODO: 次タスクで実装
questionRoutes.get("/", (c) => c.json({ message: "question routes" }));
