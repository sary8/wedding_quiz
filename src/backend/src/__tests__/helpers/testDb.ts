import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../../db/schema.js";

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL UNIQUE,
    host_secret TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    current_question_index INTEGER NOT NULL DEFAULT -1,
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'none',
    media_url TEXT,
    choice_type TEXT NOT NULL DEFAULT 'text',
    choice1 TEXT NOT NULL,
    choice2 TEXT NOT NULL,
    choice3 TEXT NOT NULL,
    choice4 TEXT NOT NULL,
    choice1_image_url TEXT,
    choice2_image_url TEXT,
    choice3_image_url TEXT,
    choice4_image_url TEXT,
    correct_choice INTEGER NOT NULL,
    time_limit_seconds INTEGER NOT NULL DEFAULT 20,
    points INTEGER NOT NULL DEFAULT 1000
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    selfie_file_name TEXT,
    connection_id TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL UNIQUE,
    total_score INTEGER NOT NULL DEFAULT 0,
    current_rank INTEGER NOT NULL DEFAULT 0,
    is_connected INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    choice_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    response_time_ms REAL NOT NULL,
    score_awarded INTEGER NOT NULL DEFAULT 0,
    answered_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS answers_question_participant_idx ON answers(question_id, participant_id)`,
  `CREATE TABLE IF NOT EXISTS question_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'none',
    media_url TEXT,
    choice_type TEXT NOT NULL DEFAULT 'text',
    choice1 TEXT NOT NULL,
    choice2 TEXT NOT NULL,
    choice3 TEXT NOT NULL,
    choice4 TEXT NOT NULL,
    choice1_image_url TEXT,
    choice2_image_url TEXT,
    choice3_image_url TEXT,
    choice4_image_url TEXT,
    correct_choice INTEGER NOT NULL,
    time_limit_seconds INTEGER NOT NULL DEFAULT 20,
    points INTEGER NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL DEFAULT ''
  )`,
];

let client: Client;

export const testSchema = schema;
export let db: LibSQLDatabase<typeof schema>;

export async function initTestDb() {
  client = createClient({ url: "file::memory:" });
  db = drizzle(client, { schema });
  await client.execute("PRAGMA foreign_keys = ON");
  for (const sql of CREATE_TABLES_SQL) {
    await client.execute(sql);
  }
}

export async function resetTestDb() {
  await client.execute("DELETE FROM answers");
  await client.execute("DELETE FROM participants");
  await client.execute("DELETE FROM questions");
  await client.execute("DELETE FROM quizzes");
  await client.execute("DELETE FROM question_bank");
}
