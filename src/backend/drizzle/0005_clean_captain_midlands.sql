PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_question_bank` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text(500) NOT NULL,
	`media_type` text DEFAULT 'none' NOT NULL,
	`media_url` text,
	`question_type` text DEFAULT 'four_choice' NOT NULL,
	`choice_type` text DEFAULT 'text' NOT NULL,
	`choice1` text(200) NOT NULL,
	`choice2` text(200) NOT NULL,
	`choice3` text(200),
	`choice4` text(200),
	`choice1_image_url` text,
	`choice2_image_url` text,
	`choice3_image_url` text,
	`choice4_image_url` text,
	`correct_choice` integer NOT NULL,
	`time_limit_seconds` integer DEFAULT 20 NOT NULL,
	`points` integer DEFAULT 1000 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_question_bank`("id", "text", "media_type", "media_url", "question_type", "choice_type", "choice1", "choice2", "choice3", "choice4", "choice1_image_url", "choice2_image_url", "choice3_image_url", "choice4_image_url", "correct_choice", "time_limit_seconds", "points", "created_at") SELECT "id", "text", "media_type", "media_url", 'four_choice', "choice_type", "choice1", "choice2", "choice3", "choice4", "choice1_image_url", "choice2_image_url", "choice3_image_url", "choice4_image_url", "correct_choice", "time_limit_seconds", "points", "created_at" FROM `question_bank`;--> statement-breakpoint
DROP TABLE `question_bank`;--> statement-breakpoint
ALTER TABLE `__new_question_bank` RENAME TO `question_bank`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`text` text(500) NOT NULL,
	`media_type` text DEFAULT 'none' NOT NULL,
	`media_url` text,
	`question_type` text DEFAULT 'four_choice' NOT NULL,
	`choice_type` text DEFAULT 'text' NOT NULL,
	`choice1` text(200) NOT NULL,
	`choice2` text(200) NOT NULL,
	`choice3` text(200),
	`choice4` text(200),
	`choice1_image_url` text,
	`choice2_image_url` text,
	`choice3_image_url` text,
	`choice4_image_url` text,
	`correct_choice` integer NOT NULL,
	`time_limit_seconds` integer DEFAULT 20 NOT NULL,
	`points` integer DEFAULT 1000 NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "quiz_id", "order_index", "text", "media_type", "media_url", "question_type", "choice_type", "choice1", "choice2", "choice3", "choice4", "choice1_image_url", "choice2_image_url", "choice3_image_url", "choice4_image_url", "correct_choice", "time_limit_seconds", "points") SELECT "id", "quiz_id", "order_index", "text", "media_type", "media_url", 'four_choice', "choice_type", "choice1", "choice2", "choice3", "choice4", "choice1_image_url", "choice2_image_url", "choice3_image_url", "choice4_image_url", "correct_choice", "time_limit_seconds", "points" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;