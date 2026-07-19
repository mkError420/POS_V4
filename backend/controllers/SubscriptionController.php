<?php
/**
 * Subscription Controller
 * Handles subscription plans, user subscriptions, and manual payment verification
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class SubscriptionController {

    public static function getPlans() {
        try {
            $stmt = DB::query('SELECT id, name, billing_cycle, price, features, status, created_at FROM subscription_plans WHERE status = "active" ORDER BY price ASC');
            $plans = $stmt->fetchAll();

            foreach ($plans as &$plan) {
                $plan['id'] = (int)$plan['id'];
                $plan['price'] = (float)$plan['price'];
                $plan['features'] = $plan['features'] ? json_decode($plan['features'], true) : [];
            }

            header('Content-Type: application/json');
            echo json_encode($plans);
        } catch (\Exception $e) {
            error_log('Get subscription plans error: ' . $e->getMessage());
            Auth::jsonError('Server error fetching subscription plans.', 500);
        }
    }

    public static function getAllPlans() {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query('SELECT id, name, billing_cycle, price, features, status, created_at, updated_at FROM subscription_plans ORDER BY status DESC, price ASC');
            $plans = $stmt->fetchAll();

            foreach ($plans as &$plan) {
                $plan['id'] = (int)$plan['id'];
                $plan['price'] = (float)$plan['price'];
                $plan['features'] = $plan['features'] ? json_decode($plan['features'], true) : [];
            }

            header('Content-Type: application/json');
            echo json_encode($plans);
        } catch (\Exception $e) {
            error_log('Get all subscription plans error: ' . $e->getMessage());
            Auth::jsonError('Server error fetching subscription plans.', 500);
        }
    }

    public static function createPlan($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        $name = trim($requestData['name'] ?? '');
        $billingCycle = $requestData['billing_cycle'] ?? '';
        $price = $requestData['price'] ?? null;
        $features = $requestData['features'] ?? [];
        $status = $requestData['status'] ?? 'active';

        if (empty($name) || empty($billingCycle) || $price === null) {
            Auth::jsonError('Plan name, billing cycle, and price are required.', 400);
        }

        if (!in_array($billingCycle, ['monthly', 'quarterly', 'yearly'])) {
            Auth::jsonError('Invalid billing cycle. Must be monthly, quarterly, or yearly.', 400);
        }

        try {
            $featuresJson = is_array($features) ? json_encode($features) : $features;

            DB::query(
                'INSERT INTO subscription_plans (name, billing_cycle, price, features, status) VALUES (?, ?, ?, ?, ?)',
                [$name, $billingCycle, $price, $featuresJson, $status]
            );

            $planId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Subscription plan created successfully.',
                'plan_id' => (int)$planId
            ]);
        } catch (\Exception $e) {
            error_log('Create subscription plan error: ' . $e->getMessage());
            Auth::jsonError('Server error creating subscription plan.', 500);
        }
    }

    public static function updatePlan($planId, $requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        $name = trim($requestData['name'] ?? '');
        $billingCycle = $requestData['billing_cycle'] ?? '';
        $price = $requestData['price'] ?? null;
        $features = $requestData['features'] ?? null;
        $status = $requestData['status'] ?? null;

        try {
            $updateFields = [];
            $params = [];

            if (!empty($name)) {
                $updateFields[] = 'name = ?';
                $params[] = $name;
            }
            if (!empty($billingCycle)) {
                if (!in_array($billingCycle, ['monthly', 'quarterly', 'yearly'])) {
                    Auth::jsonError('Invalid billing cycle. Must be monthly, quarterly, or yearly.', 400);
                }
                $updateFields[] = 'billing_cycle = ?';
                $params[] = $billingCycle;
            }
            if ($price !== null) {
                $updateFields[] = 'price = ?';
                $params[] = $price;
            }
            if ($features !== null) {
                $featuresJson = is_array($features) ? json_encode($features) : $features;
                $updateFields[] = 'features = ?';
                $params[] = $featuresJson;
            }
            if ($status !== null) {
                $updateFields[] = 'status = ?';
                $params[] = $status;
            }

            if (empty($updateFields)) {
                Auth::jsonError('No fields to update.', 400);
            }

            $params[] = $planId;
            DB::query('UPDATE subscription_plans SET ' . implode(', ', $updateFields) . ' WHERE id = ?', $params);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription plan updated successfully.']);
        } catch (\Exception $e) {
            error_log('Update subscription plan error: ' . $e->getMessage());
            Auth::jsonError('Server error updating subscription plan.', 500);
        }
    }

    public static function deletePlan($planId) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            DB::query('DELETE FROM subscription_plans WHERE id = ?', [$planId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription plan deleted successfully.']);
        } catch (\Exception $e) {
            error_log('Delete subscription plan error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting subscription plan.', 500);
        }
    }

    public static function subscribe($requestData) {
        Auth::authenticate();
        Auth::authorize(['shop_admin', 'shop_staff']);
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $planId = $requestData['plan_id'] ?? null;
        $paymentMethod = $requestData['payment_method'] ?? '';
        $transactionId = trim($requestData['transaction_id'] ?? '');
        $amountPaid = $requestData['amount_paid'] ?? null;

        if (empty($planId) || empty($paymentMethod)) {
            Auth::jsonError('Plan ID and payment method are required.', 400);
        }

        if (!in_array($paymentMethod, ['bkash', 'nogod', 'rocket', 'banking', 'cash', 'card', 'other'])) {
            Auth::jsonError('Invalid payment method.', 400);
        }

        try {
            $stmt = DB::query('SELECT price, billing_cycle FROM subscription_plans WHERE id = ? AND status = "active"', [$planId]);
            $plan = $stmt->fetch();

            if (!$plan) {
                Auth::jsonError('Selected subscription plan is not available.', 404);
            }

            $price = (float)$plan['price'];
            $billingCycle = $plan['billing_cycle'];
            $paidAmount = $amountPaid !== null ? (float)$amountPaid : $price;

            $startDate = date('Y-m-d');
            $endDate = date('Y-m-d', strtotime($billingCycle === 'monthly' ? '+1 month' : ($billingCycle === 'quarterly' ? '+3 months' : '+1 year')));

            DB::query(
                'INSERT INTO shop_subscriptions (shop_id, plan_id, start_date, end_date, status, payment_method, transaction_id, amount_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $planId, $startDate, $endDate, 'pending', $paymentMethod, $transactionId ?: null, $paidAmount]
            );

            $subscriptionId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Subscription request submitted successfully. Please wait for admin approval.',
                'subscription_id' => (int)$subscriptionId
            ]);
        } catch (\Exception $e) {
            error_log('Subscribe error: ' . $e->getMessage());
            Auth::jsonError('Server error processing subscription.', 500);
        }
    }

    public static function uploadPaymentDocument($subscriptionId) {
        Auth::authenticate();
        Auth::authorize(['shop_admin', 'shop_staff']);
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        if (!isset($_FILES['payment_document']) || $_FILES['payment_document']['error'] !== UPLOAD_ERR_OK) {
            Auth::jsonError('No payment document uploaded or upload error.', 400);
        }

        $file = $_FILES['payment_document'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
        $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($file['type'], $allowedTypes) && !in_array($fileExtension, ['jpg', 'jpeg', 'png', 'webp', 'pdf'])) {
            Auth::jsonError('Invalid file type. Only JPG, PNG, WEBP and PDF files are allowed.', 400);
        }

        $maxSize = 5 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            Auth::jsonError('File size exceeds 5MB limit.', 400);
        }

        try {
            $filePath = $file['tmp_name'];
            $fileData = file_get_contents($filePath);
            $base64 = base64_encode($fileData);
            $mimeType = $file['type'] ?: 'application/octet-stream';
            $dataUri = 'data:' . $mimeType . ';base64,' . $base64;

            DB::query(
                'UPDATE shop_subscriptions SET payment_document = ? WHERE id = ? AND shop_id = ?',
                [$dataUri, $subscriptionId, $shopId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Payment document uploaded successfully.']);
        } catch (\Exception $e) {
            error_log('Upload payment document error: ' . $e->getMessage());
            Auth::jsonError('Server error uploading payment document.', 500);
        }
    }

    public static function getMySubscription() {
        Auth::authenticate();
        Auth::authorize(['shop_admin', 'shop_staff']);
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT ss.*, sp.name as plan_name, sp.billing_cycle, sp.price, sp.features 
                 FROM shop_subscriptions ss 
                 JOIN subscription_plans sp ON ss.plan_id = sp.id 
                 WHERE ss.shop_id = ? 
                 ORDER BY ss.created_at DESC 
                 LIMIT 1',
                [$shopId]
            );
            $subscription = $stmt->fetch();

            if ($subscription) {
                $subscription['id'] = (int)$subscription['id'];
                $subscription['shop_id'] = (int)$subscription['shop_id'];
                $subscription['plan_id'] = (int)$subscription['plan_id'];
                $subscription['price'] = (float)$subscription['price'];
                $subscription['amount_paid'] = (float)$subscription['amount_paid'];
                $subscription['features'] = $subscription['features'] ? json_decode($subscription['features'], true) : [];
            }

            header('Content-Type: application/json');
            echo json_encode($subscription ?: []);
        } catch (\Exception $e) {
            error_log('Get my subscription error: ' . $e->getMessage());
            Auth::jsonError('Server error fetching subscription details.', 500);
        }
    }

    public static function getAllSubscriptions() {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        $status = $_GET['status'] ?? '';

        try {
            $sql = 'SELECT ss.*, sp.name as plan_name, sp.billing_cycle, sp.price, s.name as shop_name, s.email as shop_email 
                    FROM shop_subscriptions ss 
                    JOIN subscription_plans sp ON ss.plan_id = sp.id 
                    JOIN shops s ON ss.shop_id = s.id';

            $params = [];
            if (!empty($status)) {
                $sql .= ' WHERE ss.status = ?';
                $params[] = $status;
            }

            $sql .= ' ORDER BY ss.created_at DESC';

            $stmt = DB::query($sql, $params);
            $subscriptions = $stmt->fetchAll();

            foreach ($subscriptions as &$sub) {
                $sub['id'] = (int)$sub['id'];
                $sub['shop_id'] = (int)$sub['shop_id'];
                $sub['plan_id'] = (int)$sub['plan_id'];
                $sub['price'] = (float)$sub['price'];
                $sub['amount_paid'] = (float)$sub['amount_paid'];
            }

            header('Content-Type: application/json');
            echo json_encode($subscriptions);
        } catch (\Exception $e) {
            error_log('Get all subscriptions error: ' . $e->getMessage());
            Auth::jsonError('Server error fetching subscriptions.', 500);
        }
    }

    public static function approveSubscription($subscriptionId) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query('SELECT * FROM shop_subscriptions WHERE id = ?', [$subscriptionId]);
            $subscription = $stmt->fetch();

            if (!$subscription) {
                Auth::jsonError('Subscription not found.', 404);
            }

            DB::query(
                'UPDATE shop_subscriptions SET status = "active" WHERE id = ?',
                [$subscriptionId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription approved successfully.']);
        } catch (\Exception $e) {
            error_log('Approve subscription error: ' . $e->getMessage());
            Auth::jsonError('Server error approving subscription.', 500);
        }
    }

    public static function rejectSubscription($subscriptionId) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query('SELECT * FROM shop_subscriptions WHERE id = ?', [$subscriptionId]);
            $subscription = $stmt->fetch();

            if (!$subscription) {
                Auth::jsonError('Subscription not found.', 404);
            }

            DB::query(
                'UPDATE shop_subscriptions SET status = "rejected" WHERE id = ?',
                [$subscriptionId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription rejected successfully.']);
        } catch (\Exception $e) {
            error_log('Reject subscription error: ' . $e->getMessage());
            Auth::jsonError('Server error rejecting subscription.', 500);
        }
    }

    public static function cancelSubscription($subscriptionId) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query('SELECT * FROM shop_subscriptions WHERE id = ?', [$subscriptionId]);
            $subscription = $stmt->fetch();

            if (!$subscription) {
                Auth::jsonError('Subscription not found.', 404);
            }

            DB::query(
                'UPDATE shop_subscriptions SET status = "cancelled" WHERE id = ?',
                [$subscriptionId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription cancelled successfully.']);
        } catch (\Exception $e) {
            error_log('Cancel subscription error: ' . $e->getMessage());
            Auth::jsonError('Server error cancelling subscription.', 500);
        }
    }

    public static function guestSubscription($requestData) {
        // No authentication required for guest subscription requests
        $shopName = trim($requestData['shop_name'] ?? '');
        $shopEmail = trim($requestData['shop_email'] ?? '');
        $planId = $requestData['plan_id'] ?? null;
        $paymentMethod = $requestData['payment_method'] ?? '';
        $transactionId = trim($requestData['transaction_id'] ?? '');
        $amountPaid = $requestData['amount_paid'] ?? null;

        if (empty($shopName) || empty($shopEmail) || empty($planId) || empty($paymentMethod)) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Shop name, shop email, plan ID, and payment method are required.']);
            return;
        }

        if (!filter_var($shopEmail, FILTER_VALIDATE_EMAIL)) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email address.']);
            return;
        }

        if (!in_array($paymentMethod, ['bkash', 'nogod', 'rocket', 'banking'])) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payment method.']);
            return;
        }

        try {
            // Check if the plan exists and is active
            $stmt = DB::query('SELECT price, billing_cycle FROM subscription_plans WHERE id = ? AND status = "active"', [$planId]);
            $plan = $stmt->fetch();

            if (!$plan) {
                header('Content-Type: application/json');
                http_response_code(404);
                echo json_encode(['error' => 'Selected subscription plan is not available.']);
                return;
            }

            $price = (float)$plan['price'];
            $billingCycle = $plan['billing_cycle'];
            $paidAmount = $amountPaid !== null ? (float)$amountPaid : $price;

            // Check if shop already exists with this email
            $stmt = DB::query('SELECT id FROM shops WHERE email = ?', [$shopEmail]);
            $existingShop = $stmt->fetch();

            if ($existingShop) {
                // Shop exists, create subscription for existing shop
                $shopId = $existingShop['id'];
                
                // Check if there's already a pending subscription for this shop
                $stmt = DB::query(
                    'SELECT id FROM shop_subscriptions WHERE shop_id = ? AND status = "pending"',
                    [$shopId]
                );
                $pendingSubscription = $stmt->fetch();

                if ($pendingSubscription) {
                    header('Content-Type: application/json');
                    http_response_code(400);
                    echo json_encode(['error' => 'You already have a pending subscription request. Please wait for admin approval.']);
                    return;
                }
            } else {
                // Create new shop with pending status
                $generatedPassword = bin2hex(random_bytes(8)); // Generate random password
                $passwordHash = password_hash($generatedPassword, PASSWORD_DEFAULT);

                DB::query(
                    'INSERT INTO shops (name, email, status) VALUES (?, ?, "pending")',
                    [$shopName, $shopEmail]
                );

                $shopId = DB::lastInsertId();

                // Create a default shop admin user
                DB::query(
                    'INSERT INTO users (name, email, password, role, shop_id) VALUES (?, ?, ?, "shop_admin", ?)',
                    [$shopName, $shopEmail, $passwordHash, $shopId]
                );
            }

            // Calculate subscription dates
            $startDate = date('Y-m-d');
            $endDate = date('Y-m-d', strtotime($billingCycle === 'monthly' ? '+1 month' : ($billingCycle === 'quarterly' ? '+3 months' : '+1 year')));

            // Create subscription
            DB::query(
                'INSERT INTO shop_subscriptions (shop_id, plan_id, start_date, end_date, status, payment_method, transaction_id, amount_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $planId, $startDate, $endDate, 'pending', $paymentMethod, $transactionId ?: null, $paidAmount]
            );

            $subscriptionId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Subscription request submitted successfully! The superadmin will review your request and contact you at ' . $shopEmail,
                'subscription_id' => (int)$subscriptionId
            ]);
        } catch (\Exception $e) {
            error_log('Guest subscription error: ' . $e->getMessage());
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['error' => 'Server error processing subscription request.']);
        }
    }

    public static function subscriptionCart($requestData) {
        // No authentication required for cart submissions
        $plans         = $requestData['plans'] ?? [];
        $totalAmount   = $requestData['total_amount'] ?? 0;
        $customerName  = trim($requestData['customer_name']  ?? '');
        $customerEmail = trim($requestData['customer_email'] ?? '');
        $customerPhone = trim($requestData['customer_phone'] ?? '');
        $paymentMethod = trim($requestData['payment_method'] ?? '');
        $transactionId = trim($requestData['transaction_id'] ?? '');
        $amountPaid    = $requestData['amount_paid'] ?? null;

        if (empty($plans) || !is_array($plans) || empty($customerName) || empty($customerEmail) || empty($customerPhone)) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Plans, customer name, email, and phone are required.']);
            return;
        }

        if (!filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email address.']);
            return;
        }

        $allowedMethods = ['bkash', 'nagad', 'rocket', 'banking', ''];
        if (!empty($paymentMethod) && !in_array($paymentMethod, $allowedMethods)) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payment method.']);
            return;
        }

        try {
            // Validate all plans exist and are active
            $planIds = implode(',', array_fill(0, count($plans), '?'));
            $stmt = DB::query("SELECT id, name, price, billing_cycle FROM subscription_plans WHERE id IN ($planIds) AND status = 'active'", $plans);
            $validPlans = $stmt->fetchAll();

            if (count($validPlans) !== count($plans)) {
                header('Content-Type: application/json');
                http_response_code(400);
                echo json_encode(['error' => 'One or more selected plans are not available.']);
                return;
            }

            // Calculate expected total
            $calculatedTotal = 0;
            foreach ($validPlans as $plan) {
                $calculatedTotal += (float)$plan['price'];
            }

            // Tolerate tiny floating-point differences and an empty/missing total
            if ($totalAmount === 0 || $totalAmount === null) {
                $totalAmount = $calculatedTotal;
            } elseif (abs($calculatedTotal - (float)$totalAmount) > 0.01) {
                header('Content-Type: application/json');
                http_response_code(400);
                echo json_encode(['error' => 'Total amount mismatch.']);
                return;
            }

            $paidAmount = $amountPaid !== null ? (float)$amountPaid : $calculatedTotal;

            // Persist the selected plan ids (not the full plan objects) so the column
            // stays a valid, concise JSON array regardless of JSON column strictness.
            $planIds = array_map(function ($p) { return (int)$p['id']; }, $validPlans);

            // Create cart entry — includes payment fields
            DB::query(
                'INSERT INTO subscription_carts
                    (customer_name, customer_email, customer_phone, plans, total_amount, payment_method, transaction_id, amount_paid, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending")',
                [
                    $customerName, $customerEmail, $customerPhone,
                    json_encode($planIds), $totalAmount,
                    $paymentMethod ?: null,
                    $transactionId ?: null,
                    $paidAmount
                ]
            );

            $cartId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Subscription request submitted! The superadmin will review your payment and contact you at ' . $customerEmail,
                'cart_id' => (int)$cartId
            ]);
        } catch (\Exception $e) {
            error_log('Subscription cart error: ' . $e->getMessage());
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['error' => 'Server error processing cart submission.']);
        }
    }

    public static function getCarts() {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        try {
            $stmt = DB::query('SELECT * FROM subscription_carts ORDER BY created_at DESC');
            $carts = $stmt->fetchAll();

            foreach ($carts as &$cart) {
                $cart['id']           = (int)$cart['id'];
                $cart['total_amount'] = (float)$cart['total_amount'];
                $cart['amount_paid']  = isset($cart['amount_paid']) ? (float)$cart['amount_paid'] : null;

                // Plans are stored as a JSON array of IDs — expand into full plan objects
                $planIds = $cart['plans'] ? json_decode($cart['plans'], true) : [];
                $planIds = array_filter(array_map(function ($p) {
                    return is_array($p) ? (int)($p['id'] ?? 0) : (int)$p;
                }, $planIds), function ($id) { return $id > 0; });

                $expandedPlans = [];
                if (!empty($planIds)) {
                    $placeholders = implode(',', array_fill(0, count($planIds), '?'));
                    $stmt = DB::query(
                        "SELECT id, name, billing_cycle, price, features FROM subscription_plans WHERE id IN ($placeholders)",
                        array_values($planIds)
                    );
                    while ($plan = $stmt->fetch()) {
                        $plan['id']    = (int)$plan['id'];
                        $plan['price'] = (float)$plan['price'];
                        $plan['features'] = $plan['features'] ? json_decode($plan['features'], true) : [];
                        $expandedPlans[] = $plan;
                    }
                }
                $cart['plans'] = $expandedPlans;
            }

            header('Content-Type: application/json');
            echo json_encode($carts);
        } catch (\Exception $e) {
            error_log('Get carts error: ' . $e->getMessage());
            Auth::jsonError('Server error fetching carts.', 500);
        }
    }

    public static function updateCartStatus($cartId, $status) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);

        if (!in_array($status, ['approved', 'rejected', 'completed'])) {
            Auth::jsonError('Invalid status.', 400);
        }

        try {
            $stmt = DB::query('SELECT * FROM subscription_carts WHERE id = ?', [$cartId]);
            $cart = $stmt->fetch();

            if (!$cart) {
                Auth::jsonError('Cart not found.', 404);
            }

            DB::query(
                'UPDATE subscription_carts SET status = ? WHERE id = ?',
                [$status, $cartId]
            );

            // If approved, create actual subscriptions
            if ($status === 'approved') {
                $plans = json_decode($cart['plans'], true);
                
                // Create shop if needed
                $shopName = $cart['customer_name'] . "'s Shop";
                $shopEmail = $cart['customer_email'];
                
                $stmt = DB::query('SELECT id FROM shops WHERE email = ?', [$shopEmail]);
                $existingShop = $stmt->fetch();

                if (!$existingShop) {
                    $generatedPassword = bin2hex(random_bytes(8));
                    $passwordHash = password_hash($generatedPassword, PASSWORD_DEFAULT);

                    DB::query(
                        'INSERT INTO shops (name, email, status) VALUES (?, ?, "active")',
                        [$shopName, $shopEmail]
                    );

                    $shopId = DB::lastInsertId();

                    DB::query(
                        'INSERT INTO users (name, email, password, role, shop_id) VALUES (?, ?, ?, "shop_admin", ?)',
                        [$cart['customer_name'], $shopEmail, $passwordHash, $shopId]
                    );
                } else {
                    $shopId = $existingShop['id'];
                }

                // Create subscriptions for each plan — carry through payment info from cart
                $cartPaymentMethod = $cart['payment_method'] ?? 'cart';
                $cartTransactionId = $cart['transaction_id'] ?? ('CART-' . $cartId);
                $cartAmountPaid    = (float)($cart['amount_paid'] ?? 0);

                foreach ($plans as $planRef) {
                    $planId = is_array($planRef) ? (int)($planRef['id'] ?? 0) : (int)$planRef;
                    if ($planId <= 0) continue;

                    $stmt = DB::query('SELECT billing_cycle, price FROM subscription_plans WHERE id = ?', [$planId]);
                    $plan = $stmt->fetch();
                    if (!$plan) continue;

                    $billingCycle = $plan['billing_cycle'];
                    $price        = (float)$plan['price'];

                    $startDate = date('Y-m-d');
                    $endDate   = date('Y-m-d', strtotime(
                        $billingCycle === 'monthly'   ? '+1 month' :
                        ($billingCycle === 'quarterly' ? '+3 months' : '+1 year')
                    ));

                    // Use actual amount_paid from cart (split evenly if multiple plans)
                    $perPlanPaid = count($plans) > 1
                        ? round($cartAmountPaid / count($plans), 2)
                        : ($cartAmountPaid ?: $price);

                    DB::query(
                        'INSERT INTO shop_subscriptions
                            (shop_id, plan_id, start_date, end_date, status, payment_method, transaction_id, amount_paid)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [$shopId, $planId, $startDate, $endDate, 'active',
                         $cartPaymentMethod, $cartTransactionId, $perPlanPaid]
                    );
                }
            }

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Cart status updated successfully.']);
        } catch (\Exception $e) {
            error_log('Update cart status error: ' . $e->getMessage());
            Auth::jsonError('Server error updating cart status: ' . $e->getMessage(), 500);
        }
    }
}
