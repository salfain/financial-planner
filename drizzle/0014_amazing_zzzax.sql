CREATE TABLE `recurring_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`next_due_date` text NOT NULL,
	`is_subscription` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_posted_date` text,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recurring_templates_type_check" CHECK("recurring_templates"."type" IN ('income', 'expense')),
	CONSTRAINT "recurring_templates_amount_positive" CHECK("recurring_templates"."amount" > 0),
	CONSTRAINT "recurring_templates_frequency_check" CHECK("recurring_templates"."frequency" IN ('weekly', 'monthly', 'quarterly', 'yearly'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_templates_workspace_request_uidx` ON `recurring_templates` (`workspace_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `recurring_templates_workspace_due_idx` ON `recurring_templates` (`workspace_id`,`active`,`next_due_date`);