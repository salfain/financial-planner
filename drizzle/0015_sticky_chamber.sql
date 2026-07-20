PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_name` text DEFAULT 'Pemilik' NOT NULL,
	`store_name` text DEFAULT 'Financial Planner' NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`configured` integer DEFAULT false NOT NULL,
	`configured_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("id", "profile_name", "store_name", "currency", "timezone", "configured", "configured_at", "created_at", "updated_at") SELECT "id", "profile_name", "store_name", "currency", "timezone", "configured", "configured_at", "created_at", "updated_at" FROM `workspaces`;--> statement-breakpoint
DROP TABLE `workspaces`;--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;--> statement-breakpoint
PRAGMA foreign_keys=ON;