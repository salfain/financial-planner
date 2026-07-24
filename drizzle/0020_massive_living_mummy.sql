CREATE TABLE `category_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`keyword` text NOT NULL,
	`category` text NOT NULL,
	`transaction_type` text DEFAULT 'expense' NOT NULL,
	`match_type` text DEFAULT 'contains' NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "category_rules_transaction_type_check" CHECK("category_rules"."transaction_type" IN ('expense', 'income')),
	CONSTRAINT "category_rules_match_type_check" CHECK("category_rules"."match_type" IN ('contains', 'starts_with', 'exact')),
	CONSTRAINT "category_rules_priority_check" CHECK("category_rules"."priority" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_rules_workspace_keyword_type_uidx` ON `category_rules` (`workspace_id`,lower("keyword"),`transaction_type`);--> statement-breakpoint
CREATE INDEX `category_rules_workspace_active_idx` ON `category_rules` (`workspace_id`,`active`);