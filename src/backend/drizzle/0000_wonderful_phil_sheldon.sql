CREATE TABLE `answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`participant_id` integer NOT NULL,
	`choice_index` integer NOT NULL,
	`is_correct` integer NOT NULL,
	`response_time_ms` real NOT NULL,
	`score_awarded` integer DEFAULT 0 NOT NULL,
	`answered_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_participant_idx` ON `answers` (`question_id`,`participant_id`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`nickname` text(30) NOT NULL,
	`selfie_file_name` text,
	`connection_id` text DEFAULT '' NOT NULL,
	`token` text(64) NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`current_rank` integer DEFAULT 0 NOT NULL,
	`is_connected` integer DEFAULT false NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_token_unique` ON `participants` (`token`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`order_index` integer NOT NULL,
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
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text(6) NOT NULL,
	`host_secret` text(64) NOT NULL,
	`title` text(200) NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_question_index` integer DEFAULT -1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_room_code_unique` ON `quizzes` (`room_code`);