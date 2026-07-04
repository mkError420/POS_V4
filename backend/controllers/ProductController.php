<?php
/**
 * Product Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class ProductController {

    public static function listProducts() {
        Auth::authenticate();
        Auth::enforceTenant();

        $search = $_GET['search'] ?? null;
        $low_stock = $_GET['low_stock'] ?? null;
        $expiring = $_GET['expiring'] ?? null;
        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        try {
            $sql = "SELECT p.*, s.name AS supplier_name, sh.name AS shop_name
                    FROM products p
                    LEFT JOIN suppliers s ON p.supplier_id = s.id
                    LEFT JOIN shops sh ON p.shop_id = sh.id
                    WHERE " . ($hasShop ? "p.shop_id = ?" : "1=1");
            
            $params = $hasShop ? [$shopId] : [];

            if (!empty($search)) {
                $sql .= " AND (p.name LIKE ? OR p.sku LIKE ?)";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }

            if ($low_stock === 'true') {
                $sql .= " AND p.stock_quantity <= p.low_stock_threshold";
            }

            if ($expiring === 'true') {
                $sql .= " AND p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)";
            }

            $sql .= " ORDER BY p.name ASC";

            $stmt = DB::query($sql, $params);
            $products = $stmt->fetchAll();

            // Cast numeric fields appropriately
            foreach ($products as &$p) {
                $p['id'] = (int)$p['id'];
                $p['shop_id'] = (int)$p['shop_id'];
                $p['price'] = (float)$p['price'];
                $p['cost_price'] = (float)$p['cost_price'];
                $p['stock_quantity'] = (int)$p['stock_quantity'];
                $p['low_stock_threshold'] = (int)$p['low_stock_threshold'];
                $p['supplier_id'] = $p['supplier_id'] !== null ? (int)$p['supplier_id'] : null;
            }

            header('Content-Type: application/json');
            echo json_encode($products);

        } catch (\Exception $e) {
            error_log('Fetch products error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving products.', 500);
        }
    }

    public static function getProduct($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        try {
            $sql = "SELECT p.*, s.name AS supplier_name 
                    FROM products p
                    LEFT JOIN suppliers s ON p.supplier_id = s.id
                    WHERE p.id = ?";
            
            $params = [(int)$id];

            if ($hasShop) {
                $sql .= " AND p.shop_id = ?";
                $params[] = $shopId;
            }

            $stmt = DB::query($sql, $params);
            $product = $stmt->fetch();

            if (!$product) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            $product['id'] = (int)$product['id'];
            $product['shop_id'] = (int)$product['shop_id'];
            $product['price'] = (float)$product['price'];
            $product['cost_price'] = (float)$product['cost_price'];
            $product['stock_quantity'] = (int)$product['stock_quantity'];
            $product['low_stock_threshold'] = (int)$product['low_stock_threshold'];
            $product['supplier_id'] = $product['supplier_id'] !== null ? (int)$product['supplier_id'] : null;

            header('Content-Type: application/json');
            echo json_encode($product);

        } catch (\Exception $e) {
            error_log('Fetch product by ID error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving product.', 500);
        }
    }

    public static function createProduct($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $sku = $requestData['sku'] ?? '';
        $price = $requestData['price'] ?? null;
        $cost_price = $requestData['cost_price'] ?? null;
        $stock_quantity = $requestData['stock_quantity'] ?? 0;
        $low_stock_threshold = $requestData['low_stock_threshold'] ?? 10;
        $expiry_date = $requestData['expiry_date'] ?? null;
        $supplier_id = $requestData['supplier_id'] ?? null;
        $unit = $requestData['unit'] ?? 'piece';

        if (empty($name) || empty($sku) || $price === null || $cost_price === null) {
            Auth::jsonError('Please provide name, sku, price, and cost price.', 400);
        }

        try {
            // Check SKU duplicate in the shop
            $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $sku]);
            if ($stmt->fetch()) {
                Auth::jsonError('SKU already exists for this shop.', 400);
            }

            DB::query(
                'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $shopId,
                    $name,
                    $sku,
                    $price,
                    $cost_price,
                    (int)$stock_quantity,
                    (int)$low_stock_threshold,
                    !empty($expiry_date) ? $expiry_date : null,
                    !empty($supplier_id) ? (int)$supplier_id : null,
                    $unit
                ]
            );

            $newProductId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Product created successfully.',
                'productId' => (int)$newProductId
            ]);

        } catch (\Exception $e) {
            error_log('Create product error: ' . $e->getMessage());
            Auth::jsonError('Server error creating product.', 500);
        }
    }

    public static function updateProduct($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $productId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Verify product belongs to active tenant
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Verify SKU uniqueness if changing SKU
            $sku = $requestData['sku'] ?? null;
            if ($sku !== null) {
                $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ?', [$shopId, $sku, $productId]);
                if ($stmt->fetch()) {
                    Auth::jsonError('Another product with this SKU already exists.', 400);
                }
            }

            // Perform update
            $updateFields = [];
            $params = [];

            $fieldsToUpdate = [
                'name' => 'name',
                'sku' => 'sku',
                'price' => 'price',
                'cost_price' => 'cost_price',
                'stock_quantity' => 'stock_quantity',
                'low_stock_threshold' => 'low_stock_threshold',
                'expiry_date' => 'expiry_date',
                'supplier_id' => 'supplier_id',
                'unit' => 'unit'
            ];

            foreach ($fieldsToUpdate as $apiKey => $dbKey) {
                if (array_key_exists($apiKey, $requestData)) {
                    $val = $requestData[$apiKey];
                    $updateFields[] = "`$dbKey` = ?";
                    if (($dbKey === 'expiry_date' || $dbKey === 'supplier_id') && empty($val)) {
                        $params[] = null;
                    } else {
                        $params[] = $val;
                    }
                }
            }

            if (empty($updateFields)) {
                Auth::jsonError('No update parameters provided.', 400);
            }

            $params[] = $productId;
            $params[] = $shopId;

            DB::query(
                "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ? AND shop_id = ?",
                $params
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Product updated successfully.']);

        } catch (\Exception $e) {
            error_log('Update product error: ' . $e->getMessage());
            Auth::jsonError('Server error updating product.', 500);
        }
    }

    public static function deleteProduct($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $productId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Verify product belongs to active tenant
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Delete product
            DB::query('DELETE FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Product deleted successfully.']);

        } catch (\PDOException $e) {
            error_log('Delete product database error: ' . $e->getMessage());
            // Foreign key constraint violation (ER_ROW_IS_REFERENCED_2 matches SQLSTATE 23000)
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete product. It is referenced in sales transaction records.', 400);
            }
            Auth::jsonError('Server error deleting product.', 500);
        } catch (\Exception $e) {
            error_log('Delete product error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting product.', 500);
        }
    }
}
