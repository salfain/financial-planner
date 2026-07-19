CREATE TABLE `cashflow_forecast_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`horizon_days` integer DEFAULT 60 NOT NULL,
	`monthly_income_override` integer DEFAULT 0 NOT NULL,
	`income_day` integer DEFAULT 25 NOT NULL,
	`minimum_cash_buffer` integer DEFAULT 2000000 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cashflow_forecast_horizon_check" CHECK("cashflow_forecast_settings"."horizon_days" IN (30, 60, 90)),
	CONSTRAINT "cashflow_forecast_income_nonnegative" CHECK("cashflow_forecast_settings"."monthly_income_override" >= 0),
	CONSTRAINT "cashflow_forecast_income_day_check" CHECK("cashflow_forecast_settings"."income_day" BETWEEN 1 AND 28),
	CONSTRAINT "cashflow_forecast_buffer_nonnegative" CHECK("cashflow_forecast_settings"."minimum_cash_buffer" >= 0)
);
