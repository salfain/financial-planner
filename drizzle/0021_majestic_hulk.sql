CREATE TABLE `sinking_fund_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`fund_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fund_id`) REFERENCES `sinking_funds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sinking_fund_entries_type_check" CHECK("sinking_fund_entries"."type" IN ('allocate', 'release')),
	CONSTRAINT "sinking_fund_entries_amount_positive" CHECK("sinking_fund_entries"."amount" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sinking_fund_entries_workspace_request_uidx` ON `sinking_fund_entries` (`workspace_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `sinking_fund_entries_fund_date_idx` ON `sinking_fund_entries` (`workspace_id`,`fund_id`,`date`);--> statement-breakpoint
CREATE TABLE `sinking_funds` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text DEFAULT 'Lainnya' NOT NULL,
	`target_amount` integer NOT NULL,
	`current_amount` integer DEFAULT 0 NOT NULL,
	`monthly_contribution` integer DEFAULT 0 NOT NULL,
	`target_date` text NOT NULL,
	`account_id` text NOT NULL,
	`color` text DEFAULT '#16876f' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sinking_funds_target_positive" CHECK("sinking_funds"."target_amount" > 0),
	CONSTRAINT "sinking_funds_current_nonnegative" CHECK("sinking_funds"."current_amount" >= 0),
	CONSTRAINT "sinking_funds_current_within_target" CHECK("sinking_funds"."current_amount" <= "sinking_funds"."target_amount"),
	CONSTRAINT "sinking_funds_monthly_nonnegative" CHECK("sinking_funds"."monthly_contribution" >= 0)
);
--> statement-breakpoint
CREATE INDEX `sinking_funds_workspace_target_idx` ON `sinking_funds` (`workspace_id`,`active`,`target_date`);--> statement-breakpoint
CREATE INDEX `sinking_funds_workspace_account_idx` ON `sinking_funds` (`workspace_id`,`account_id`);