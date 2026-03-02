PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text(6) NOT NULL,
	`host_secret` text(64) NOT NULL,
	`title` text(200) NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_question_index` integer DEFAULT -1 NOT NULL,
	`team_mode` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_quizzes`("id", "room_code", "host_secret", "title", "status", "current_question_index", "team_mode", "created_at") SELECT "id", "room_code", "host_secret", "title", "status", "current_question_index", "team_mode", "created_at" FROM `quizzes`;--> statement-breakpoint
DROP TABLE `quizzes`;--> statement-breakpoint
ALTER TABLE `__new_quizzes` RENAME TO `quizzes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_room_code_unique` ON `quizzes` (`room_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_order_idx` ON `questions` (`quiz_id`,`order_index`);