<?php
/**
 * 100201 Football Shop - Database Connection Configuration (PHP PDO)
 * Suitable for Apache / Nginx / XAMPP / cPanel phpMyAdmin setups.
 */

// Database credentials
define('DB_HOST', 'localhost');
define('DB_NAME', '100201_football_shop');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

function getDbConnection() {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            header('Content-Type: application/json', true, 500);
            echo json_encode([
                'success' => false,
                'error' => 'Database connection failed: ' . $e->getMessage()
            ]);
            exit;
        }
    }

    return $pdo;
}

// Example API helper: Fetch all products with their 4 gallery photos
function getAllProductsWithPhotos() {
    $db = getDbConnection();
    
    $stmt = $db->query("SELECT * FROM products ORDER BY is_featured DESC, price_php DESC");
    $products = $stmt->fetchAll();

    foreach ($products as &$p) {
        $imgStmt = $db->prepare("SELECT image_url, angle_label FROM product_images WHERE product_id = ? ORDER BY display_order ASC");
        $imgStmt->execute([$p['id']]);
        $p['gallery_photos'] = $imgStmt->fetchAll();
    }

    return $products;
}
