-- Migration: Add payment fields to subscription_carts table
-- Run this if the table already exists from the previous migration.
-- Safe to run multiple times (uses IF NOT EXISTS checks via column inspection).

ALTER TABLE `subscription_carts`
  ADD COLUMN IF NOT EXISTS `payment_method`  VARCHAR(30)    NULL    AFTER `status`,
  ADD COLUMN IF NOT EXISTS `transaction_id`  VARCHAR(100)   NULL    AFTER `payment_method`,
  ADD COLUMN IF NOT EXISTS `amount_paid`     DECIMAL(10,2)  NULL    AFTER `transaction_id`;

-- If your MySQL version does not support IF NOT EXISTS on ADD COLUMN, use:
-- ALTER TABLE `subscription_carts` ADD COLUMN `payment_method` VARCHAR(30) NULL;
-- ALTER TABLE `subscription_carts` ADD COLUMN `transaction_id` VARCHAR(100) NULL;
-- ALTER TABLE `subscription_carts` ADD COLUMN `amount_paid` DECIMAL(10,2) NULL;

-- Full table definition (for fresh installs — use this instead of the old migration):
CREATE TABLE IF NOT EXISTS `subscription_carts` (
  `id`              INT AUTO_INCREMENT,
  `customer_name`   VARCHAR(100)   NOT NULL,
  `customer_email`  VARCHAR(100)   NOT NULL,
  `customer_phone`  VARCHAR(20)    NOT NULL,
  `plans`           JSON           NOT NULL,
  `total_amount`    DECIMAL(10,2)  NOT NULL,
  `status`          ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
  `payment_method`  VARCHAR(30)    NULL,
  `transaction_id`  VARCHAR(100)   NULL,
  `amount_paid`     DECIMAL(10,2)  NULL,
  `notes`           TEXT           NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_subscription_carts_status` (`status`),
  INDEX `idx_subscription_carts_email`  (`customer_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
