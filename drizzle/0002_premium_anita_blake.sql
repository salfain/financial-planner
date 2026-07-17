ALTER TABLE `bills` ADD `last_paid_period` text;--> statement-breakpoint
UPDATE `bills`
SET `last_paid_period` = substr(`due_date`, 1, 7)
WHERE `paid` = 1 AND `last_paid_period` IS NULL;
