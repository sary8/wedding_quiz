ALTER TABLE `question_bank` ADD `point_multiplier` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `point_multiplier` integer DEFAULT 1 NOT NULL;