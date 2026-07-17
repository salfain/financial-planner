CREATE TABLE `investment_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text NOT NULL,
	`asset_class` text NOT NULL,
	`exchange` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'IDR' NOT NULL,
	`manual_price` integer,
	`latest_price_cache` integer DEFAULT 0 NOT NULL,
	`price_source` text DEFAULT 'unavailable' NOT NULL,
	`price_status` text DEFAULT 'unavailable' NOT NULL,
	`price_updated_at` text,
	`active` integer DEFAULT true NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "investment_assets_manual_price_nonnegative" CHECK("investment_assets"."manual_price" IS NULL OR "investment_assets"."manual_price" >= 0),
	CONSTRAINT "investment_assets_latest_price_nonnegative" CHECK("investment_assets"."latest_price_cache" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_assets_workspace_symbol_uidx` ON `investment_assets` (`workspace_id`,lower("ticker"),lower("exchange"));--> statement-breakpoint
CREATE UNIQUE INDEX `investment_assets_workspace_request_uidx` ON `investment_assets` (`workspace_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `investment_assets_workspace_active_idx` ON `investment_assets` (`workspace_id`,`active`);--> statement-breakpoint
CREATE TABLE `investment_positions` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`units_micro` integer DEFAULT 0 NOT NULL,
	`cost_basis` integer DEFAULT 0 NOT NULL,
	`realized_pl` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `investment_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "investment_positions_units_nonnegative" CHECK("investment_positions"."units_micro" >= 0),
	CONSTRAINT "investment_positions_cost_nonnegative" CHECK("investment_positions"."cost_basis" >= 0)
);
--> statement-breakpoint
CREATE INDEX `investment_positions_workspace_idx` ON `investment_positions` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `investment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`units_micro` integer NOT NULL,
	`price_per_unit` integer NOT NULL,
	`gross_amount` integer NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`net_amount` integer NOT NULL,
	`average_cost_after` integer NOT NULL,
	`remaining_units_micro` integer NOT NULL,
	`realized_pl` integer DEFAULT 0 NOT NULL,
	`linked_cash_transaction_id` text NOT NULL,
	`linked_adjustment_transaction_id` text,
	`note` text,
	`request_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `investment_assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "investment_transactions_units_positive" CHECK("investment_transactions"."units_micro" > 0),
	CONSTRAINT "investment_transactions_price_positive" CHECK("investment_transactions"."price_per_unit" > 0),
	CONSTRAINT "investment_transactions_gross_positive" CHECK("investment_transactions"."gross_amount" > 0),
	CONSTRAINT "investment_transactions_fee_nonnegative" CHECK("investment_transactions"."fee" >= 0),
	CONSTRAINT "investment_transactions_tax_nonnegative" CHECK("investment_transactions"."tax" >= 0),
	CONSTRAINT "investment_transactions_net_positive" CHECK("investment_transactions"."net_amount" > 0),
	CONSTRAINT "investment_transactions_remaining_nonnegative" CHECK("investment_transactions"."remaining_units_micro" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_transactions_workspace_request_uidx` ON `investment_transactions` (`workspace_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `investment_transactions_workspace_date_idx` ON `investment_transactions` (`workspace_id`,`date`);--> statement-breakpoint
CREATE INDEX `investment_transactions_asset_idx` ON `investment_transactions` (`workspace_id`,`asset_id`);