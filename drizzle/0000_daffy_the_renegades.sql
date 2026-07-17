CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text DEFAULT '' NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`mask` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#16876f' NOT NULL,
	`liability` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "accounts_balance_nonnegative" CHECK("accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE INDEX `accounts_workspace_idx` ON `accounts` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bills_amount_positive" CHECK("bills"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `bills_workspace_due_idx` ON `bills` (`workspace_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `bills_workspace_account_idx` ON `bills` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`category` text NOT NULL,
	`amount_limit` integer NOT NULL,
	`period` text NOT NULL,
	`color` text DEFAULT '#16876f' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "budgets_limit_positive" CHECK("budgets"."amount_limit" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_workspace_category_period_uidx` ON `budgets` (`workspace_id`,`category`,`period`);--> statement-breakpoint
CREATE INDEX `budgets_workspace_period_idx` ON `budgets` (`workspace_id`,`period`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`target` integer NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`deadline` text NOT NULL,
	`color` text DEFAULT '#16876f' NOT NULL,
	`icon` text DEFAULT 'target' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "goals_target_positive" CHECK("goals"."target" > 0),
	CONSTRAINT "goals_current_nonnegative" CHECK("goals"."current" >= 0)
);
--> statement-breakpoint
CREATE INDEX `goals_workspace_deadline_idx` ON `goals` (`workspace_id`,`deadline`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`merchant` text,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`destination_account_id` text,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`idempotency_key` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transactions_amount_positive" CHECK("transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `transactions_workspace_date_idx` ON `transactions` (`workspace_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_workspace_idempotency_uidx` ON `transactions` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`store_name` text DEFAULT 'VINN STORE' NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL,
	`configured` integer DEFAULT false NOT NULL,
	`configured_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
