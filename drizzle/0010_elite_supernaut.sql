CREATE TABLE `roadmap_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`horizon_months` integer DEFAULT 24 NOT NULL,
	`income_adjustment_pct` integer DEFAULT 0 NOT NULL,
	`expense_adjustment_pct` integer DEFAULT 0 NOT NULL,
	`annual_investment_return_pct` integer DEFAULT 6 NOT NULL,
	`annual_inflation_pct` integer DEFAULT 3 NOT NULL,
	`monthly_investment` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "roadmap_horizon_check" CHECK("roadmap_settings"."horizon_months" IN (12, 24, 36, 60)),
	CONSTRAINT "roadmap_income_adjustment_check" CHECK("roadmap_settings"."income_adjustment_pct" BETWEEN -50 AND 100),
	CONSTRAINT "roadmap_expense_adjustment_check" CHECK("roadmap_settings"."expense_adjustment_pct" BETWEEN -50 AND 100),
	CONSTRAINT "roadmap_return_check" CHECK("roadmap_settings"."annual_investment_return_pct" BETWEEN 0 AND 30),
	CONSTRAINT "roadmap_inflation_check" CHECK("roadmap_settings"."annual_inflation_pct" BETWEEN 0 AND 30),
	CONSTRAINT "roadmap_monthly_investment_nonnegative" CHECK("roadmap_settings"."monthly_investment" >= 0)
);
