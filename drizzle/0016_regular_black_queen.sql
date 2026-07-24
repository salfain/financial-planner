ALTER TABLE `workspaces` ADD `installation_id` text;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `license_token` text;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `license_activated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_installation_uidx` ON `workspaces` (`installation_id`);