CREATE TABLE `feature_preferences` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`preferences_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
