CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`period` text NOT NULL,
	`context_manifest` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_chat_messages_role_check" CHECK("ai_chat_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE INDEX `ai_chat_messages_workspace_created_idx` ON `ai_chat_messages` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'gemini' NOT NULL,
	`model` text DEFAULT 'gemini-3.5-flash' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`consent_accepted` integer DEFAULT false NOT NULL,
	`encrypted_api_key` text,
	`api_key_iv` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
