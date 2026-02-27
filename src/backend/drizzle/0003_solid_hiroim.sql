ALTER TABLE `question_bank` ADD `choice_type` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `question_bank` ADD `choice1_image_url` text;--> statement-breakpoint
ALTER TABLE `question_bank` ADD `choice2_image_url` text;--> statement-breakpoint
ALTER TABLE `question_bank` ADD `choice3_image_url` text;--> statement-breakpoint
ALTER TABLE `question_bank` ADD `choice4_image_url` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `choice_type` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `choice1_image_url` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `choice2_image_url` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `choice3_image_url` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `choice4_image_url` text;