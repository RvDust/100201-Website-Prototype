-- ============================================================================
-- 100201 FOOTBALL SHOP - OFFICIAL DATABASE DUMP
-- Compatible with: phpMyAdmin, MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Character Set: utf8mb4 / utf8mb4_unicode_ci
-- Hub Location: Pasig City, Philippines
-- Instagram: @100201footballshop_
-- Generated: 2026-09-09
-- ============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+08:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `100201_football_shop`
--
CREATE DATABASE IF NOT EXISTS `100201_football_shop` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `100201_football_shop`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Table structure for table `categories_leagues`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `categories_leagues`;
CREATE TABLE `categories_leagues` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `display_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_category_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `categories_leagues`
-- ----------------------------------------------------------------------------
INSERT INTO `categories_leagues` (`id`, `slug`, `name`, `description`, `display_order`, `is_active`) VALUES
(1, 'all', 'All Kits', 'Complete 100201 Football Shop kit inventory', 1, 1),
(2, 'retro-legends', 'Retro Archive', 'Legendary throwback kits, classic finals & historic tournament editions', 2, 1),
(3, 'international', 'World Cup / Nations', 'National teams, Euro champions & World Cup winners', 3, 1),
(4, 'la-liga', 'La Liga', 'Spanish top-flight kits including Real Madrid & FC Barcelona', 4, 1),
(5, 'premier-league', 'Premier League', 'English top division kits including Arsenal, Chelsea & Manchester United', 5, 1),
(6, 'serie-a', 'Serie A', 'Italian championship kits including AC Milan, Inter & Juventus', 6, 1),
(7, 'bundesliga', 'Bundesliga', 'German Bundesliga club editions', 7, 1);

-- ----------------------------------------------------------------------------
-- Table structure for table `products`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `club` varchar(150) NOT NULL,
  `league` varchar(100) NOT NULL,
  `season` varchar(50) NOT NULL,
  `version_type` enum('Home','Away','Third','Retro','Special') NOT NULL DEFAULT 'Home',
  `badge_text` varchar(100) DEFAULT NULL,
  `price_php` decimal(10,2) NOT NULL DEFAULT 1100.00,
  `original_price_php` decimal(10,2) DEFAULT NULL,
  `rating` decimal(2,1) NOT NULL DEFAULT 5.0,
  `reviews_count` int(11) NOT NULL DEFAULT 0,
  `description` text NOT NULL,
  `primary_image` varchar(500) NOT NULL,
  `stock_s` int(11) NOT NULL DEFAULT 0,
  `stock_m` int(11) NOT NULL DEFAULT 0,
  `stock_l` int(11) NOT NULL DEFAULT 0,
  `stock_xl` int(11) NOT NULL DEFAULT 0,
  `stock_xxl` int(11) NOT NULL DEFAULT 0,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `is_new` tinyint(1) NOT NULL DEFAULT 0,
  `availability_status` varchar(100) NOT NULL DEFAULT 'On-Hand Ready to Ship',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_product_league` (`league`),
  KEY `idx_product_featured` (`is_featured`),
  KEY `idx_product_version` (`version_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `products` (Authentic sample kits from Facebook 'ALL KITS')
-- ----------------------------------------------------------------------------
INSERT INTO `products` (`id`, `name`, `club`, `league`, `season`, `version_type`, `badge_text`, `price_php`, `original_price_php`, `rating`, `reviews_count`, `description`, `primary_image`, `stock_s`, `stock_m`, `stock_l`, `stock_xl`, `stock_xxl`, `is_featured`, `is_new`, `availability_status`) VALUES
('fb-kit-barca-2627-home', 'Barcelona \'26/\'27 Home Kit', 'FC Barcelona', 'La Liga', '2026/27', 'Home', 'NEW DROP // PASIG VAULT', 1100.00, 1300.00, 5.0, 28, 'Authentic Barcelona \'26/\'27 Home Kit photographed at 100201 Pasig Hub. Features classic Blaugrana vertical stripes, vibrant yellow Spotify sponsor logo, embroidered Barca crest, and Catalan Senyera tab detail on back of neck. All jerseys strictly follow pre-order and payment-first policy (2-3 weeks lead time). Open for Pasig pick-up and nationwide courier.', 'assets/products/barca-2627-home-1.jpg', 5, 8, 12, 6, 3, 1, 1, 'Pre-Order (2-3 Weeks)'),
('fb-kit-barca-2627-away', 'Barcelona \'26/\'27 Away Kit', 'FC Barcelona', 'La Liga', '2026/27', 'Away', 'NEW DROP // BLACK PURPLE', 1100.00, 1300.00, 4.9, 21, 'Barcelona \'26/\'27 Away Kit in sleek deep black and purple twilight tone. Features iridescent golden club crest, Spotify chest logo, Midea sleeve print, and Barca Foundation print on lower reverse. Real wooden hanger photography from 100201 Pasig Hub.', 'assets/products/barca-2627-away-1.jpg', 4, 7, 10, 5, 2, 1, 1, 'Pre-Order (2-3 Weeks)'),
('fb-kit-barca-aurora-25', 'Barcelona \'25 Special Aurora Kit', 'FC Barcelona', 'La Liga', '2024/25', 'Special', 'TOTAL 90 // LIPPZY 9', 1200.00, 1450.00, 5.0, 34, 'Exclusive Barcelona \'25 Special Aurora Edition kit in pastel pink and lavender Total 90 geometric styling. Features silver holographic Barca badge, Spotify navy crest, Total 90 bottom hip badge, and bold LIPPZY 9 player print across the reverse. Photographed on authentic 100201 wooden hanger.', 'assets/products/barca-aurora-1.jpg', 3, 6, 9, 4, 2, 1, 1, 'Pre-Order (2-3 Weeks)'),
('fb-kit-france-26-wc', 'France \'26 WC Home Kit', 'France National Team', 'International', '2026', 'Home', 'MBAPPÉ #10 // WC BADGES', 1200.00, 1400.00, 5.0, 42, 'France National Team \'26 World Cup Home Kit featuring vintage cream fold-over collar, iconic golden Gallic rooster 2-star crest, official FIFA World Cup sleeve patches, tricolor sleeve ribbons, and full MBAPPE 10 star nameset on reverse.', 'assets/products/france-26-1.jpg', 6, 10, 14, 8, 4, 1, 1, 'Pre-Order (2-3 Weeks)'),
('fb-kit-england-26-home', 'England \'26 Home Kit', 'England National Team', 'International', '2026', 'Home', 'BELLINGHAM #10 // THREE LIONS', 1200.00, 1400.00, 4.9, 19, 'England National Team \'26 Home kit in crisp white with red/navy side blade panels, embroidered Three Lions star crest, V-neck collar, and BELLINGHAM 10 player nameset. 100201 Pasig Hub archive.', 'assets/products/england-26-1.jpg', 5, 8, 11, 5, 3, 0, 1, 'Pre-Order (2-3 Weeks)'),
('fb-kit-rm-9900-retro', 'RETRO Real Madrid \'99/\'00 Home Kit', 'Real Madrid', 'La Liga', '1999/00', 'Retro', 'TEKA SPONSOR // UCL ERA', 1100.00, 1350.00, 5.0, 39, 'Iconic Retro Real Madrid 1999/2000 Home Kit from the Champions League winning campaign in Paris. Features high-sheen white fabric, navy and yellow ribbed collar, stitched Adidas Trefoil, royal Real Madrid crest, and iconic Teka chest sponsor. Real photos taken on 100201 wooden hanger.', 'assets/products/rm-9900-1.jpg', 4, 9, 15, 6, 2, 1, 0, 'Pre-Order (2-3 Weeks)'),
('fb-kit-santos-12-retro', 'RETRO Santos FC 2012 Kit', 'Santos FC', 'Brasileirão', '2012', 'Retro', 'NEYMAR JR #11 // BANCO BMG', 1200.00, 1450.00, 5.0, 51, 'Legendary Santos FC 2012 Centenary Third Kit worn during Neymar Jr\'s iconic Copa Libertadores era. Features all-black tonal body, Banco BMG sponsors, SEARA shoulder graphics, embroidered 1912-2012 Santos crest, \'Menino da Vila Desde 1912\' inner collar inscription, and NEYMAR JR 11 print.', 'assets/products/santos-12-1.jpg', 3, 7, 12, 5, 2, 1, 0, 'Pre-Order (2-3 Weeks)'),
('fb-kit-barca-2526-home', 'Barcelona \'25/\'26 Spotify Home Kit', 'FC Barcelona', 'La Liga', '2025/26', 'Home', '125TH ANNIVERSARY // SPOTIFY', 1100.00, 1300.00, 5.0, 27, 'FC Barcelona 2025/2026 Home Kit commemorating the club\'s 125th Anniversary. Half-and-half Blaugrana heritage design with golden central Spotify sponsor and classic rounded collar.', 'assets/products/barca-25-26-1.jpg', 6, 10, 12, 7, 3, 0, 1, 'Pre-Order (2-3 Weeks)'),
('fb-kit-psg-1213-retro', 'RETRO PSG \'12/\'13 Home Kit', 'Paris Saint-Germain', 'Ligue 1', '2012/13', 'Retro', 'VINTAGE FLY EMIRATES', 1100.00, 1350.00, 4.9, 18, 'Retro Paris Saint-Germain 2012/2013 Home Kit from the first Ligue 1 title under Carlo Ancelotti. Deep midnight blue body with central red and white Parisian vertical block stripe and classic Fly Emirates sponsor.', 'assets/products/psg-retro-1.jpg', 4, 8, 10, 5, 2, 0, 0, 'Pre-Order (2-3 Weeks)'),
('fb-kit-brasil-06-retro', 'Retro Brasil \'06/\'08 Home Kit', 'Brasil National Team', 'International', '2006', 'Retro', 'RONALDO #9 // WORLD CUP ARCHIVE', 1200.00, 1500.00, 5.0, 64, 'Timeless 2006 World Cup Brasil Home Kit worn by O Fenômeno Ronaldo #9. Classic canary yellow body with green stand collar, 5-star CBF crest, and official golden nameset on back.', 'assets/products/brasil-06-1.jpg', 5, 9, 14, 6, 3, 1, 0, 'On-Hand Ready to Ship'),
('fb-kit-portugal-04-retro', 'Retro Portugal \'04 Home Kit', 'Portugal National Team', 'International', '2004', 'Retro', 'C. RONALDO #17 // EURO 2004', 1200.00, 1500.00, 5.0, 47, 'Iconic Portugal Euro 2004 Total 90 Home Kit worn during Cristiano Ronaldo\'s breakout international tournament. Rich garnet red body, golden yellow circular number 17, and green collar accents.', 'assets/products/portugal-04-1.jpg', 4, 8, 11, 5, 2, 1, 0, 'On-Hand Ready to Ship'),
('fb-kit-germany-1990-retro', 'Germany Retro 1990 Home Kit', 'Germany National Team', 'International', '1990', 'Retro', 'DFB CHEVRON // ITALIA \'90', 1100.00, 1300.00, 4.9, 31, 'The quintessential World Cup 1990 Germany Home Kit featuring the legendary tricolor German flag ribbon chevron across the chest. Classic white body with DFB crest.', 'assets/products/germany-1990-1.jpg', 3, 6, 8, 4, 2, 0, 0, 'On-Hand Ready to Ship');

-- ----------------------------------------------------------------------------
-- Table structure for table `product_images` (Max 4 photos per product gallery)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `product_images`;
CREATE TABLE `product_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` varchar(64) NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `angle_label` varchar(100) NOT NULL DEFAULT 'Kit Photo',
  `display_order` int(11) NOT NULL DEFAULT 1,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_fk` (`product_id`),
  CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `product_images`
-- ----------------------------------------------------------------------------
INSERT INTO `product_images` (`product_id`, `image_url`, `angle_label`, `display_order`, `is_primary`) VALUES
('fb-kit-barca-2627-home', 'assets/products/barca-2627-home-1.jpg', 'Front Collar View', 1, 1),
('fb-kit-barca-2627-home', 'assets/products/barca-2627-home-2.jpg', 'Back Senyera Detail', 2, 0),
('fb-kit-barca-2627-away', 'assets/products/barca-2627-away-1.jpg', 'Front Spotify View', 1, 1),
('fb-kit-barca-2627-away', 'assets/products/barca-2627-away-2.jpg', 'Back Barça Foundation', 2, 0),
('fb-kit-barca-aurora-25', 'assets/products/barca-aurora-1.jpg', 'Front Total 90 View', 1, 1),
('fb-kit-barca-aurora-25', 'assets/products/barca-aurora-2.jpg', 'Back Lippzy 9', 2, 0),
('fb-kit-france-26-wc', 'assets/products/france-26-1.jpg', 'Front Collar & Crest', 1, 1),
('fb-kit-france-26-wc', 'assets/products/france-26-2.jpg', 'Back Mbappé 10', 2, 0),
('fb-kit-england-26-home', 'assets/products/england-26-1.jpg', 'Front Three Lions', 1, 1),
('fb-kit-england-26-home', 'assets/products/england-26-2.jpg', 'Away Red Kit', 2, 0),
('fb-kit-rm-9900-retro', 'assets/products/rm-9900-1.jpg', 'Front Teka Sponsor', 1, 1),
('fb-kit-rm-9900-retro', 'assets/products/rm-9900-2.jpg', 'Back Collar Detail', 2, 0),
('fb-kit-rm-9900-retro', 'assets/products/rm-9900-3.jpg', 'Collar & Trefoil Detail', 3, 0),
('fb-kit-rm-9900-retro', 'assets/products/rm-9900-4.jpg', 'Back Neck Stripe', 4, 0),
('fb-kit-santos-12-retro', 'assets/products/santos-12-1.jpg', 'Front Banco BMG', 1, 1),
('fb-kit-santos-12-retro', 'assets/products/santos-12-2.jpg', 'Back Neymar Jr 11', 2, 0),
('fb-kit-santos-12-retro', 'assets/products/santos-12-3.jpg', 'Collar & Menino Da Vila', 3, 0),
('fb-kit-santos-12-retro', 'assets/products/santos-12-4.jpg', 'Back BMG Print', 4, 0),
('fb-kit-barca-2526-home', 'assets/products/barca-25-26-1.jpg', 'Front Heritage View', 1, 1),
('fb-kit-barca-2526-home', 'assets/products/barca-25-26-2.jpg', 'Collar & Crest Detail', 2, 0),
('fb-kit-barca-2526-home', 'assets/products/barca-25-26-3.jpg', 'Fabric Weave', 3, 0),
('fb-kit-barca-2526-home', 'assets/products/barca-25-26-4.jpg', 'Lower Hem & Badges', 4, 0),
('fb-kit-psg-1213-retro', 'assets/products/psg-retro-1.jpg', 'Front Paris View', 1, 1),
('fb-kit-psg-1213-retro', 'assets/products/psg-retro-2.jpg', 'Fly Emirates Chest', 2, 0),
('fb-kit-psg-1213-retro', 'assets/products/psg-retro-3.jpg', 'Badge Detail', 3, 0),
('fb-kit-psg-1213-retro', 'assets/products/psg-retro-4.jpg', 'Back View', 4, 0),
('fb-kit-brasil-06-retro', 'assets/products/brasil-06-1.jpg', 'Front Canary Yellow', 1, 1),
('fb-kit-brasil-06-retro', 'assets/products/brasil-06-2.jpg', 'CBF 5-Star Crest', 2, 0),
('fb-kit-brasil-06-retro', 'assets/products/brasil-06-3.jpg', 'Back Ronaldo 9', 3, 0),
('fb-kit-brasil-06-retro', 'assets/products/brasil-06-4.jpg', 'Total 90 Badge', 4, 0),
('fb-kit-portugal-04-retro', 'assets/products/portugal-04-1.jpg', 'Front Garnet View', 1, 1),
('fb-kit-portugal-04-retro', 'assets/products/portugal-04-2.jpg', 'FPF Crest Detail', 2, 0),
('fb-kit-portugal-04-retro', 'assets/products/portugal-04-3.jpg', 'Back C. Ronaldo 17', 3, 0),
('fb-kit-portugal-04-retro', 'assets/products/portugal-04-4.jpg', 'Euro 2004 Sleeve Patch', 4, 0),
('fb-kit-germany-1990-retro', 'assets/products/germany-1990-1.jpg', 'Front DFB Ribbon Chevron', 1, 1);

-- ----------------------------------------------------------------------------
-- Table structure for table `payment_methods` (Philippine Payment & Pick-up Options)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payment_methods`;
CREATE TABLE `payment_methods` (
  `id` varchar(50) NOT NULL,
  `type` varchar(50) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `account_name` varchar(150) NOT NULL,
  `account_number` varchar(100) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `badge_text` varchar(50) NOT NULL,
  `instructions` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `payment_methods`
-- ----------------------------------------------------------------------------
INSERT INTO `payment_methods` (`id`, `type`, `brand`, `account_name`, `account_number`, `is_default`, `badge_text`, `instructions`, `is_active`) VALUES
('pm-gcash-01', 'gcash', 'GCash', '100201 Football Shop', '0917-882-0101', 1, 'GCASH', 'Send payment to 0917-882-0101. Include your Order ID in the payment message notes.', 1),
('pm-maya-02', 'maya', 'Maya', '100201 Football Shop', '0917-882-0101', 0, 'MAYA', 'Send via Maya to 0917-882-0101. Verification is instantaneous.', 1),
('pm-bdo-03', 'bank', 'BDO Unibank', '100201 Sports Merch', '0012-3456-7890', 0, 'BDO', 'Transfer to BDO Checking Account. Upload deposit screenshot in tracking view.', 1),
('pm-card-04', 'card', 'Credit / Debit Card', 'Stripe / Maya Payment Gateway', 'Visa & Mastercard Accepted', 0, 'VISA', 'Secure online card payment via PCI-DSS compliant gateway.', 1),
('pm-cop-05', 'pickup', 'Cash on Pick-up', '100201 Store Collection Counter', 'Pay upon release at store', 0, 'PICKUP', 'Pick up directly at 100201 Football Shop with zero shipping fee.', 1);

-- ----------------------------------------------------------------------------
-- Table structure for table `promo_codes`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `promo_codes`;
CREATE TABLE `promo_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `discount_percent` int(11) NOT NULL DEFAULT 10,
  `min_spend_php` decimal(10,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_promo_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `promo_codes`
-- ----------------------------------------------------------------------------
INSERT INTO `promo_codes` (`code`, `discount_percent`, `min_spend_php`, `description`, `is_active`) VALUES
('100201VIP', 10, 0.00, 'Official 100201 VIP Member 10% discount on all kits', 1),
('STORE15', 15, 2000.00, 'Store community discount for orders above ₱2,000', 1);

-- ----------------------------------------------------------------------------
-- Table structure for table `orders`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` varchar(64) NOT NULL,
  `order_date` datetime NOT NULL,
  `customer_name` varchar(150) NOT NULL,
  `customer_email` varchar(150) NOT NULL,
  `customer_phone` varchar(50) NOT NULL,
  `fulfillment_type` enum('delivery','pickup') NOT NULL DEFAULT 'delivery',
  `delivery_address` text DEFAULT NULL,
  `city` varchar(100) NOT NULL DEFAULT 'Pasig City',
  `postal_code` varchar(20) NOT NULL DEFAULT '1600',
  `country` varchar(100) NOT NULL DEFAULT 'Philippines',
  `subtotal_php` decimal(10,2) NOT NULL,
  `discount_php` decimal(10,2) NOT NULL DEFAULT 0.00,
  `shipping_fee_php` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_amount_php` decimal(10,2) NOT NULL,
  `promo_code_applied` varchar(50) DEFAULT NULL,
  `payment_method_type` varchar(50) NOT NULL,
  `payment_brand` varchar(100) NOT NULL,
  `payment_status` enum('pending','verified','failed') NOT NULL DEFAULT 'verified',
  `order_status` enum('Order Confirmed','Processing & Custom Printing','Shipped','Out for Delivery','Delivered','Cancelled') NOT NULL DEFAULT 'Order Confirmed',
  `carrier` varchar(100) NOT NULL DEFAULT 'J&T Express Philippines',
  `tracking_number` varchar(100) NOT NULL,
  `estimated_delivery` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_tracking_num` (`tracking_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `orders`
-- Note: Sample orders removed. Orders are recorded upon customer checkout.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Table structure for table `order_items`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(64) NOT NULL,
  `product_id` varchar(64) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `size` varchar(10) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price_php` decimal(10,2) NOT NULL,
  `custom_name` varchar(100) DEFAULT NULL,
  `custom_number` varchar(10) DEFAULT NULL,
  `line_total_php` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_fk` (`order_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `order_items`
-- Note: Sample order line items removed. Generated per placed order.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Table structure for table `order_milestones` (5-Stage Visual Tracker Pipeline)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_milestones`;
CREATE TABLE `order_milestones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(64) NOT NULL,
  `stage_name` varchar(100) NOT NULL,
  `timestamp_str` varchar(50) DEFAULT NULL,
  `description` text NOT NULL,
  `is_completed` tinyint(1) NOT NULL DEFAULT 0,
  `display_order` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_milestones_order_fk` (`order_id`),
  CONSTRAINT `fk_milestones_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `order_milestones`
-- Note: Sample order milestones removed. Generated per order during fulfillment.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Table structure for table `store_settings`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `store_settings`;
CREATE TABLE `store_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Dumping data for table `store_settings`
-- ----------------------------------------------------------------------------
INSERT INTO `store_settings` (`setting_key`, `setting_value`, `description`) VALUES
('shop_name', '100201 Football Shop', 'Official Store Title'),
('instagram_handle', '@100201footballshop_', 'Official Instagram Handle'),
('instagram_url', 'https://www.instagram.com/100201footballshop_', 'Official Instagram Profile URL'),
('facebook_url', 'https://www.facebook.com/justthriftphl', 'Official Facebook Page URL'),
('tiktok_url', 'https://www.tiktok.com/@100201footballshop?fbclid=IwcGRvZgVleHRuA2FlbQIxMABicmlkETFkWTIwMFpjNE5Vb1M2U3NVc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHo6P7Sj_Fsqv2edyiNNJOntxYEZC_pZtuXR_xEzjiQzlqyMWQFB3tRhz5Zk4_aem_CoQufJ-BhEU5FGen0fhN0g', 'Official TikTok Profile URL'),
('location_hub', 'Pasig City, Metro Manila, Philippines', 'Primary Physical Collection Point'),
('currency_default', 'PHP', 'Default Currency Code'),
('currency_symbol', '₱', 'Default Currency Symbol'),
('free_shipping_threshold_php', '1500.00', 'Minimum order amount for free nationwide delivery'),
('active_vip_promo', '100201VIP', 'Default featured promo code');

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
