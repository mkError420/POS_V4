-- Migration: Add payment methods table
-- This table allows SuperAdmin to configure payment methods for subscription payments

CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` INT AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `method_id` VARCHAR(50) NOT NULL UNIQUE,
  `account_number` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT 'blue',
  `instructions` TEXT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_methods_id` (`method_id`),
  INDEX `idx_payment_methods_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default payment methods
INSERT INTO `payment_methods` (`name`, `method_id`, `account_number`, `color`, `instructions`, `display_order`, `status`) VALUES
('bKash', 'bkash', '017XXXXXXXX', 'rose', 'Send money to this bKash number and enter the transaction ID', 1, 'active'),
('Nagad', 'nagad', '018XXXXXXXX', 'orange', 'Send money to this Nagad number and enter the transaction ID', 2, 'active'),
('Rocket', 'rocket', '019XXXXXXXX', 'violet', 'Send money to this Rocket number and enter the transaction ID', 3, 'active'),
('Bank Transfer', 'banking', 'ACC: XXXX-XXXX', 'blue', 'Transfer to this bank account and enter the transaction reference', 4, 'active');
