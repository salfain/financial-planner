ALTER TABLE `notification_settings` ADD `email_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `email_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `weekly_digest` integer DEFAULT true NOT NULL;