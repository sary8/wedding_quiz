import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const quizzes = sqliteTable("quizzes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  room_code: text("room_code", { length: 6 }).notNull().unique(),
  host_secret: text("host_secret", { length: 64 }).notNull(),
  title: text("title", { length: 200 }).notNull(),
  status: text("status", { enum: ["draft", "lobby", "in_progress", "finished"] })
    .notNull()
    .default("draft"),
  current_question_index: integer("current_question_index").notNull().default(-1),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quiz_id: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  order_index: integer("order_index").notNull(),
  text: text("text", { length: 500 }).notNull(),
  media_type: text("media_type", { enum: ["none", "image", "video"] })
    .notNull()
    .default("none"),
  media_url: text("media_url"),
  choice1: text("choice1", { length: 200 }).notNull(),
  choice2: text("choice2", { length: 200 }).notNull(),
  choice3: text("choice3", { length: 200 }).notNull(),
  choice4: text("choice4", { length: 200 }).notNull(),
  correct_choice: integer("correct_choice").notNull(), // 1-4
  time_limit_seconds: integer("time_limit_seconds").notNull().default(20),
  points: integer("points").notNull().default(1000),
});

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quiz_id: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  nickname: text("nickname", { length: 30 }).notNull(),
  selfie_file_name: text("selfie_file_name"),
  connection_id: text("connection_id").notNull().default(""),
  token: text("token", { length: 64 }).notNull().unique(),
  total_score: integer("total_score").notNull().default(0),
  current_rank: integer("current_rank").notNull().default(0),
  is_connected: integer("is_connected", { mode: "boolean" }).notNull().default(false),
  joined_at: text("joined_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const answers = sqliteTable(
  "answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    question_id: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    participant_id: integer("participant_id")
      .notNull()
      .references(() => participants.id),
    choice_index: integer("choice_index").notNull(), // 1-4
    is_correct: integer("is_correct", { mode: "boolean" }).notNull(),
    response_time_ms: real("response_time_ms").notNull(),
    score_awarded: integer("score_awarded").notNull().default(0),
    answered_at: text("answered_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("answers_question_participant_idx").on(
      table.question_id,
      table.participant_id
    ),
  ]
);
