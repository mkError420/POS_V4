-- Migration: Add subscription options table
-- This table allows SuperAdmin to configure additional options displayed above "Choose a Plan" section

CREATE TABLE IF NOT EXISTS `subscription_options` (
  `id` INT AUTO_INCREMENT,
  `title` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(50) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_subscription_options_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default subscription options
INSERT INTO `subscription_options` (`title`, `description`, `icon`, `display_order`, `status`) VALUES
('24/7 Support', 'Get round-the-clock technical support for your business', 'support', 1, 'active'),
('Cloud Backup', 'Automatic daily backups of your business data', 'cloud', 2, 'active'),
('Multi-Device Access', 'Access your POS from multiple devices simultaneously', 'devices', 3, 'active');
