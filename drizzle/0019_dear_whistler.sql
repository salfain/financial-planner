CREATE TABLE `monthly_closings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`period` text NOT NULL,
	`status` text DEFAULT 'closed' NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	`closed_at` text,
	`reopened_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "monthly_closings_period_check" CHECK("monthly_closings"."period" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "monthly_closings_status_check" CHECK("monthly_closings"."status" IN ('closed', 'open'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_closings_workspace_period_uidx` ON `monthly_closings` (`workspace_id`,`period`);--> statement-breakpoint
CREATE INDEX `monthly_closings_workspace_status_idx` ON `monthly_closings` (`workspace_id`,`status`);