ALTER TABLE `ai_settings` ADD `base_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `ai_settings`
SET `provider` = 'openai-compatible',
    `model` = 'default',
    `enabled` = false,
    `updated_at` = CURRENT_TIMESTAMP;
