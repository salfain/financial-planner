CREATE TABLE `debt_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`annual_rate_bps` integer DEFAULT 0 NOT NULL,
	`minimum_payment` integer DEFAULT 0 NOT NULL,
	`due_day` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "debt_accounts_rate_check" CHECK("debt_accounts"."annual_rate_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "debt_accounts_minimum_nonnegative" CHECK("debt_accounts"."minimum_payment" >= 0),
	CONSTRAINT "debt_accounts_due_day_check" CHECK("debt_accounts"."due_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `debt_accounts_workspace_account_uidx` ON `debt_accounts` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `debt_accounts_workspace_idx` ON `debt_accounts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `debt_payoff_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`strategy` text DEFAULT 'avalanche' NOT NULL,
	`extra_monthly_payment` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "debt_payoff_strategy_check" CHECK("debt_payoff_settings"."strategy" IN ('avalanche', 'snowball')),
	CONSTRAINT "debt_payoff_extra_nonnegative" CHECK("debt_payoff_settings"."extra_monthly_payment" >= 0)
);
