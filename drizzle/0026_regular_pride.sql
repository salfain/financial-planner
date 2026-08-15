CREATE TABLE `zakat_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`gold_price_per_gram` integer DEFAULT 0 NOT NULL,
	`nisab_grams` integer DEFAULT 85 NOT NULL,
	`haul_start_date` text DEFAULT '' NOT NULL,
	`include_investments` integer DEFAULT true NOT NULL,
	`excluded_account_ids_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "zakat_gold_price_nonnegative" CHECK("zakat_settings"."gold_price_per_gram" >= 0),
	CONSTRAINT "zakat_nisab_grams_positive" CHECK("zakat_settings"."nisab_grams" > 0)
);
