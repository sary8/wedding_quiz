CREATE TABLE `question_bank` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text(500) NOT NULL,
	`media_type` text DEFAULT 'none' NOT NULL,
	`media_url` text,
	`choice1` text(200) NOT NULL,
	`choice2` text(200) NOT NULL,
	`choice3` text(200) NOT NULL,
	`choice4` text(200) NOT NULL,
	`correct_choice` integer NOT NULL,
	`time_limit_seconds` integer DEFAULT 20 NOT NULL,
	`points` integer DEFAULT 1000 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text(4) NOT NULL,
	`host_secret` text(64) NOT NULL,
	`title` text(200) NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_question_index` integer DEFAULT -1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_quizzes`("id", "room_code", "host_secret", "title", "status", "current_question_index", "created_at") SELECT "id", "room_code", "host_secret", "title", "status", "current_question_index", "created_at" FROM `quizzes`;--> statement-breakpoint
DROP TABLE `quizzes`;--> statement-breakpoint
ALTER TABLE `__new_quizzes` RENAME TO `quizzes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_room_code_unique` ON `quizzes` (`room_code`);