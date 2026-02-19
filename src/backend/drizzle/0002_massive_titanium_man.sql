PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`participant_id` integer NOT NULL,
	`choice_index` integer NOT NULL,
	`is_correct` integer NOT NULL,
	`response_time_ms` real NOT NULL,
	`score_awarded` integer DEFAULT 0 NOT NULL,
	`answered_at` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_answers`("id", "question_id", "participant_id", "choice_index", "is_correct", "response_time_ms", "score_awarded", "answered_at") SELECT "id", "question_id", "participant_id", "choice_index", "is_correct", "response_time_ms", "score_awarded", "answered_at" FROM `answers`;--> statement-breakpoint
DROP TABLE `answers`;--> statement-breakpoint
ALTER TABLE `__new_answers` RENAME TO `answers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `answers_question_participant_idx` ON `answers` (`question_id`,`participant_id`);