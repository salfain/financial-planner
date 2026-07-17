CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`actor` text DEFAULT 'system' NOT NULL,
	`request_id` text,
	`before_json` text,
	`after_json` text,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_workspace_created_idx` ON `audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_logs_workspace_request_action_entity_uidx` ON `audit_logs` (`workspace_id`,`request_id`,`action`,`entity_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`color` text DEFAULT '#16876f' NOT NULL,
	`icon` text DEFAULT 'circle-dollar-sign' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_workspace_name_uidx` ON `categories` (`workspace_id`,lower("name"));--> statement-breakpoint
CREATE INDEX `categories_workspace_archived_idx` ON `categories` (`workspace_id`,`archived`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `transfer_group_id` text;--> statement-breakpoint
WITH `defaults` (`name`, `type`, `color`, `icon`) AS (
  VALUES
    ('Pendapatan', 'income', '#16876f', 'wallet-cards'),
    ('Makanan', 'expense', '#d4685c', 'utensils'),
    ('Transportasi', 'expense', '#4e79c7', 'car'),
    ('Tagihan', 'expense', '#da9a3a', 'receipt-text'),
    ('Tempat Tinggal', 'expense', '#8b6bb1', 'house'),
    ('Hiburan', 'expense', '#aa67a6', 'sparkles'),
    ('Kesehatan', 'expense', '#2e8b8b', 'heart-pulse'),
    ('Transfer', 'transfer', '#5574b8', 'arrow-right-left'),
    ('Investasi', 'investment', '#1c7567', 'trending-up'),
    ('Kewajiban', 'expense', '#c45b6c', 'credit-card'),
    ('Penyesuaian Saldo', 'system', '#687386', 'scale')
)
INSERT INTO `categories`
  (`id`, `workspace_id`, `name`, `type`, `color`, `icon`, `archived`, `is_default`, `created_at`, `updated_at`)
SELECT
  'cat-' || lower(hex(randomblob(16))),
  `workspaces`.`id`,
  `defaults`.`name`,
  `defaults`.`type`,
  `defaults`.`color`,
  `defaults`.`icon`,
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM `workspaces`
CROSS JOIN `defaults`
WHERE NOT EXISTS (
  SELECT 1
  FROM `categories`
  WHERE `categories`.`workspace_id` = `workspaces`.`id`
    AND lower(`categories`.`name`) = lower(`defaults`.`name`)
);
