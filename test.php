<?php
require 'backend/config/db.php';
$pdo = DB::getConnection();
$stmt = $pdo->query('SHOW CREATE TABLE products');
print_r($stmt->fetch());
$stmt2 = $pdo->query('SHOW CREATE TABLE inventory_adjustments');
print_r($stmt2->fetch());
