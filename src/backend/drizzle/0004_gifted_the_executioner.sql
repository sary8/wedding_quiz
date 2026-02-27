CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`name` text(100) NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `participants` ADD `team_id` integer REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `quizzes` ADD `team_mode` integer DEFAULT false NOT NULL;