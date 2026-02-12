import { Hono } from "hono";

export const mediaRoutes = new Hono();

// TODO: 次タスクで実装
mediaRoutes.get("/", (c) => c.json({ message: "media routes" }));
