CREATE TABLE `transaction_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`object_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transaction_attachments_size_positive" CHECK("transaction_attachments"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_attachments_object_key_uidx` ON `transaction_attachments` (`object_key`);--> statement-breakpoint
CREATE INDEX `transaction_attachments_transaction_idx` ON `transaction_attachments` (`workspace_id`,`transaction_id`);--> statement-breakpoint
CREATE TABLE `transaction_undo_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`target_audit_id` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_audit_id`) REFERENCES `audit_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_undo_events_target_uidx` ON `transaction_undo_events` (`workspace_id`,`target_audit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_undo_events_request_uidx` ON `transaction_undo_events` (`workspace_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `transaction_undo_events_workspace_created_idx` ON `transaction_undo_events` (`workspace_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `time` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `tags_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `splits_json` text DEFAULT '[]' NOT NULL;