CREATE TABLE `notification_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`bill_reminder_days` text DEFAULT '[7,3,1,0]' NOT NULL,
	`budget_warning_percent` integer DEFAULT 75 NOT NULL,
	`backup_warning_days` integer DEFAULT 7 NOT NULL,
	`goal_warning_days` integer DEFAULT 30 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_states` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`notification_key` text NOT NULL,
	`read_at` text,
	`dismissed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_states_workspace_key_uidx` ON `notification_states` (`workspace_id`,`notification_key`);--> statement-breakpoint
CREATE INDEX `notification_states_workspace_updated_idx` ON `notification_states` (`workspace_id`,`updated_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`reminder_days` text DEFAULT '7,3,1,0' NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`paid_at` text,
	`last_paid_period` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bills_amount_positive" CHECK("__new_bills"."amount" > 0),
	CONSTRAINT "bills_frequency_check" CHECK("__new_bills"."frequency" IN ('monthly'))
);
--> statement-breakpoint
INSERT INTO `__new_bills`("id", "workspace_id", "name", "amount", "due_date", "category", "account_id", "frequency", "reminder_days", "paid", "paid_at", "last_paid_period", "created_at", "updated_at") SELECT "id", "workspace_id", "name", "amount", "due_date", "category", "account_id", 'monthly', '7,3,1,0', "paid", "paid_at", "last_paid_period", "created_at", "updated_at" FROM `bills`;--> statement-breakpoint
DROP TABLE `bills`;--> statement-breakpoint
ALTER TABLE `__new_bills` RENAME TO `bills`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bills_workspace_due_idx` ON `bills` (`workspace_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `bills_workspace_account_idx` ON `bills` (`workspace_id`,`account_id`);
