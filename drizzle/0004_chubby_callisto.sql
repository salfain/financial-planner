ALTER TABLE `accounts` ADD `opening_balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `accounts`
SET `opening_balance` = `balance`
  - COALESCE(
      (
        SELECT SUM(
          CASE
            WHEN `transactions`.`type` = 'income' THEN
              CASE WHEN `accounts`.`liability` = 1
                THEN -`transactions`.`amount` ELSE `transactions`.`amount` END
            WHEN `transactions`.`type` = 'adjustment_in' THEN
              CASE WHEN `accounts`.`liability` = 1
                THEN -`transactions`.`amount` ELSE `transactions`.`amount` END
            WHEN `transactions`.`type` = 'adjustment_out' THEN
              CASE WHEN `accounts`.`liability` = 1
                THEN `transactions`.`amount` ELSE -`transactions`.`amount` END
            WHEN `transactions`.`type` = 'expense' THEN
              CASE WHEN `accounts`.`liability` = 1
                THEN `transactions`.`amount` ELSE -`transactions`.`amount` END
            WHEN `transactions`.`type` = 'refund' THEN
              CASE WHEN `accounts`.`liability` = 1
                THEN -`transactions`.`amount` ELSE `transactions`.`amount` END
            ELSE
              CASE WHEN `accounts`.`liability` = 1
                THEN `transactions`.`amount` ELSE -`transactions`.`amount` END
          END
        )
        FROM `transactions`
        WHERE `transactions`.`workspace_id` = `accounts`.`workspace_id`
          AND `transactions`.`account_id` = `accounts`.`id`
          AND `transactions`.`status` = 'completed'
          AND `transactions`.`deleted_at` IS NULL
      ),
      0
    )
  - COALESCE(
      (
        SELECT SUM(
          CASE WHEN `accounts`.`liability` = 1
            THEN -`transactions`.`amount` ELSE `transactions`.`amount` END
        )
        FROM `transactions`
        WHERE `transactions`.`workspace_id` = `accounts`.`workspace_id`
          AND `transactions`.`destination_account_id` = `accounts`.`id`
          AND `transactions`.`type` IN ('transfer', 'investment_buy')
          AND `transactions`.`status` = 'completed'
          AND `transactions`.`deleted_at` IS NULL
      ),
      0
    );
