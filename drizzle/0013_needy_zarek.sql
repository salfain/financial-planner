CREATE TABLE `emergency_fund_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`target_months` integer DEFAULT 6 NOT NULL,
	`monthly_expense_override` integer DEFAULT 0 NOT NULL,
	`monthly_contribution` integer DEFAULT 0 NOT NULL,
	`account_ids_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "emergency_fund_target_check" CHECK("emergency_fund_settings"."target_months" IN (3, 6, 9, 12)),
	CONSTRAINT "emergency_fund_expense_nonnegative" CHECK("emergency_fund_settings"."monthly_expense_override" >= 0),
	CONSTRAINT "emergency_fund_contribution_nonnegative" CHECK("emergency_fund_settings"."monthly_contribution" >= 0)
);
