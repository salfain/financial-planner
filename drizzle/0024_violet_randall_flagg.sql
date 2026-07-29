PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`category` text NOT NULL,
	`account_id` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`reminder_days` text DEFAULT '7,3,1,0' NOT NULL,
	`paid` integer DEFAULT false NOT NULL,
	`paid_at` text,
	`last_paid_period` text,
	`liability_account_id` text,
	`duration_months` integer,
	`paid_count` integer DEFAULT 0 NOT NULL,
	`current_period_paid` integer DEFAULT 0 NOT NULL,
	`total_paid` integer DEFAULT 0 NOT NULL,
	`installment_phases_json` text DEFAULT '[]' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bills_amount_positive" CHECK("__new_bills"."amount" > 0),
	CONSTRAINT "bills_frequency_check" CHECK("__new_bills"."frequency" IN ('monthly')),
	CONSTRAINT "bills_duration_check" CHECK("__new_bills"."duration_months" IS NULL OR ("__new_bills"."duration_months" >= 1 AND "__new_bills"."duration_months" <= 120)),
	CONSTRAINT "bills_paid_count_nonnegative" CHECK("__new_bills"."paid_count" >= 0),
	CONSTRAINT "bills_current_period_paid_nonnegative" CHECK("__new_bills"."current_period_paid" >= 0),
	CONSTRAINT "bills_total_paid_nonnegative" CHECK("__new_bills"."total_paid" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_bills`("id", "workspace_id", "name", "amount", "due_date", "category", "account_id", "frequency", "reminder_days", "paid", "paid_at", "last_paid_period", "liability_account_id", "duration_months", "paid_count", "current_period_paid", "total_paid", "installment_phases_json", "completed", "created_at", "updated_at") SELECT "id", "workspace_id", "name", "amount", "due_date", "category", "account_id", "frequency", "reminder_days", "paid", "paid_at", "last_paid_period", "liability_account_id", CASE WHEN "duration_months" BETWEEN 1 AND 120 THEN "duration_months" ELSE NULL END, CASE WHEN "paid_count" >= 0 THEN "paid_count" ELSE 0 END, 0, 0, "installment_phases_json", "completed", "created_at", "updated_at" FROM `bills`;--> statement-breakpoint
DROP TABLE `bills`;--> statement-breakpoint
ALTER TABLE `__new_bills` RENAME TO `bills`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bills_workspace_due_idx` ON `bills` (`workspace_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `bills_workspace_account_idx` ON `bills` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `bills_workspace_liability_idx` ON `bills` (`workspace_id`,`liability_account_id`);
