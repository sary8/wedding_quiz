import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { mkdirSync } from "fs";

const DB_PATH = "./data/wedding_quiz.db";

mkdirSync("./data", { recursive: true });

const client = createClient({
  url: `file:${DB_PATH}`,
});

export const db = drizzle(client, { schema });
export { schema };
