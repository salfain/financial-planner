CREATE TABLE `backup_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`frequency` text DEFAULT 'weekly' NOT NULL,
	`last_backup_at` text,
	`next_backup_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `data_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`object_key` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`period` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "data_exports_kind_check" CHECK("data_exports"."kind" IN ('backup', 'report', 'migration_report')),
	CONSTRAINT "data_exports_status_check" CHECK("data_exports"."status" IN ('ready', 'failed')),
	CONSTRAINT "data_exports_size_nonnegative" CHECK("data_exports"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_exports_object_key_uidx` ON `data_exports` (`object_key`);--> statement-breakpoint
CREATE INDEX `data_exports_workspace_created_idx` ON `data_exports` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `data_exports_workspace_kind_idx` ON `data_exports` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE TABLE `migration_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_schema_version` text NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`object_key` text NOT NULL,
	`counts_json` text DEFAULT '{}' NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`errors_json` text DEFAULT '[]' NOT NULL,
	`balance_difference` integer DEFAULT 0 NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`applied_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "migration_jobs_status_check" CHECK("migration_jobs"."status" IN ('preview', 'applied', 'cancelled', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `migration_jobs_workspace_request_uidx` ON `migration_jobs` (`workspace_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `migration_jobs_object_key_uidx` ON `migration_jobs` (`object_key`);--> statement-breakpoint
CREATE INDEX `migration_jobs_workspace_created_idx` ON `migration_jobs` (`workspace_id`,`created_at`);