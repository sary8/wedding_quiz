ALTER TABLE `quizzes` ADD `finished_at` text;--> statement-breakpoint
CREATE INDEX `answers_participant_id_idx` ON `answers` (`participant_id`);--> statement-breakpoint
CREATE INDEX `participants_quiz_id_idx` ON `participants` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `participants_connection_id_idx` ON `participants` (`connection_id`);