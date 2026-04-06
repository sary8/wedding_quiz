import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const quizzes = sqliteTable("quizzes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  room_code: text("room_code", { length: 6 }).notNull().unique(),
  host_secret: text("host_secret", { length: 64 }).notNull(),
  title: text("title", { length: 200 }).notNull(),
  status: text("status", { enum: ["draft", "lobby", "in_progress", "finished"] })
    .notNull()
    .default("draft"),
  current_question_index: integer("current_question_index").notNull().default(-1),
  team_mode: integer("team_mode", { mode: "boolean" }).notNull().default(false),
  finished_at: text("finished_at"),
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
  question_type: text("question_type", { enum: ["four_choice", "true_false"] })
    .notNull()
    .default("four_choice"),
  choice_type: text("choice_type", { enum: ["text", "image"] })
    .notNull()
    .default("text"),
  choice1: text("choice1", { length: 200 }).notNull(),
  choice2: text("choice2", { length: 200 }).notNull(),
  choice3: text("choice3", { length: 200 }),
  choice4: text("choice4", { length: 200 }),
  choice1_image_url: text("choice1_image_url"),
  choice2_image_url: text("choice2_image_url"),
  choice3_image_url: text("choice3_image_url"),
  choice4_image_url: text("choice4_image_url"),
  correct_choice: integer("correct_choice").notNull(), // 1-4 (true_false: 1-2)
  time_limit_seconds: integer("time_limit_seconds").notNull().default(20),
  points: integer("points").notNull().default(1000),
  point_multiplier: integer("point_multiplier").notNull().default(1),
}, (table) => [
  uniqueIndex("questions_quiz_order_idx").on(table.quiz_id, table.order_index),
]);

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quiz_id: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  name: text("name", { length: 100 }).notNull(),
  order_index: integer("order_index").notNull().default(0),
});

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quiz_id: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  team_id: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
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
}, (table) => [
  index("participants_quiz_id_idx").on(table.quiz_id),
  index("participants_connection_id_idx").on(table.connection_id),
]);

export const answers = sqliteTable(
  "answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    question_id: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    participant_id: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
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
    index("answers_participant_id_idx").on(table.participant_id),
  ]
);

export const questionBank = sqliteTable("question_bank", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text", { length: 500 }).notNull(),
  media_type: text("media_type", { enum: ["none", "image", "video"] })
    .notNull()
    .default("none"),
  media_url: text("media_url"),
  question_type: text("question_type", { enum: ["four_choice", "true_false"] })
    .notNull()
    .default("four_choice"),
  choice_type: text("choice_type", { enum: ["text", "image"] })
    .notNull()
    .default("text"),
  choice1: text("choice1", { length: 200 }).notNull(),
  choice2: text("choice2", { length: 200 }).notNull(),
  choice3: text("choice3", { length: 200 }),
  choice4: text("choice4", { length: 200 }),
  choice1_image_url: text("choice1_image_url"),
  choice2_image_url: text("choice2_image_url"),
  choice3_image_url: text("choice3_image_url"),
  choice4_image_url: text("choice4_image_url"),
  correct_choice: integer("correct_choice").notNull(), // 1-4 (true_false: 1-2)
  time_limit_seconds: integer("time_limit_seconds").notNull().default(20),
  points: integer("points").notNull().default(1000),
  point_multiplier: integer("point_multiplier").notNull().default(1),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// --- Relations ---

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  questions: many(questions),
  participants: many(participants),
  teams: many(teams),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [questions.quiz_id], references: [quizzes.id] }),
  answers: many(answers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [teams.quiz_id], references: [quizzes.id] }),
  participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [participants.quiz_id], references: [quizzes.id] }),
  team: one(teams, { fields: [participants.team_id], references: [teams.id] }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  question: one(questions, { fields: [answers.question_id], references: [questions.id] }),
  participant: one(participants, { fields: [answers.participant_id], references: [participants.id] }),
}));
