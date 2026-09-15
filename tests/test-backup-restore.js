// 100201 Football Shop - Backup & Restoration Integrity Test
// Validates:
// 1. Snapshot creation of products and orders database files
// 2. Automated recovery after simulated corruption or data deletion
// 3. 100% byte & record-level restoration accuracy

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, '..', 'database');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');

function runBackupRestoreTest() {
  console.log('====================================================');
  console.log('📦 Starting Database Backup & Restoration Test');
  console.log('====================================================');

  // Step 1: Ensure directories and source files exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  if (!fs.existsSync(PRODUCTS_FILE) || !fs.existsSync(ORDERS_FILE)) {
    console.error('[FAIL] Source database files missing before backup!');
    process.exit(1);
  }

  const originalProductsRaw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
  const originalOrdersRaw = fs.readFileSync(ORDERS_FILE, 'utf-8');

  const origProducts = JSON.parse(originalProductsRaw);
  const origOrders = JSON.parse(originalOrdersRaw);

  console.log(`[PASS] Read original data: ${origProducts.length} products, ${origOrders.length} orders.`);

  // Step 2: Create timestamped snapshot backup
  const snapshotTimestamp = Date.now();
  const prodBackupFile = path.join(BACKUP_DIR, `products.backup.${snapshotTimestamp}.json`);
  const ordersBackupFile = path.join(BACKUP_DIR, `orders.backup.${snapshotTimestamp}.json`);

  fs.writeFileSync(prodBackupFile, originalProductsRaw, 'utf-8');
  fs.writeFileSync(ordersBackupFile, originalOrdersRaw, 'utf-8');

  console.log(`[PASS] Created snapshot backup in database/backups/:`);
  console.log(`       - ${path.basename(prodBackupFile)}`);
  console.log(`       - ${path.basename(ordersBackupFile)}`);

  // Step 3: Simulate Data Loss & Corruption
  console.log('\n--- Simulating Data Loss & Corruption ---');
  fs.writeFileSync(PRODUCTS_FILE, '{"corrupted": true, "syntax_error": ', 'utf-8');
  fs.writeFileSync(ORDERS_FILE, '[]', 'utf-8'); // Cleared to empty

  let isCorrupted = false;
  try {
    JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
  } catch (e) {
    isCorrupted = true;
    console.log('[PASS] Confirmed simulated database corruption in products.json (syntax error).');
  }

  if (!isCorrupted) {
    console.error('[FAIL] products.json corruption simulation failed!');
    process.exit(1);
  }

  // Step 4: Execute Restoration from Snapshot
  console.log('\n--- Executing Snapshot Restoration ---');
  fs.copyFileSync(prodBackupFile, PRODUCTS_FILE);
  fs.copyFileSync(ordersBackupFile, ORDERS_FILE);

  // Step 5: Verify 100% Recovery
  const restoredProductsRaw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
  const restoredOrdersRaw = fs.readFileSync(ORDERS_FILE, 'utf-8');

  let restoredProducts, restoredOrders;
  try {
    restoredProducts = JSON.parse(restoredProductsRaw);
    restoredOrders = JSON.parse(restoredOrdersRaw);
  } catch (e) {
    console.error('[FAIL] Restored files failed JSON parse!', e.message);
    process.exit(1);
  }

  if (restoredProducts.length !== origProducts.length) {
    console.error(`[FAIL] Product count mismatch: expected ${origProducts.length}, got ${restoredProducts.length}`);
    process.exit(1);
  }

  if (restoredOrders.length !== origOrders.length) {
    console.error(`[FAIL] Order count mismatch: expected ${origOrders.length}, got ${restoredOrders.length}`);
    process.exit(1);
  }

  if (restoredProductsRaw === originalProductsRaw && restoredOrdersRaw === originalOrdersRaw) {
    console.log(`[PASS] 100% Byte-level and structural restoration verified!`);
    console.log(`       - Products restored: ${restoredProducts.length} items`);
    console.log(`       - Orders restored:   ${restoredOrders.length} items`);
  } else {
    console.error('[FAIL] Restored file content differs from original snapshot!');
    process.exit(1);
  }

  // Clean up temporary test snapshot files
  try {
    fs.unlinkSync(prodBackupFile);
    fs.unlinkSync(ordersBackupFile);
    console.log('[PASS] Temporary snapshot artifacts cleaned up.');
  } catch (_) {}

  console.log('\n====================================================');
  console.log('🎉 Database Backup & Restoration Test: ALL PASSED!');
  console.log('====================================================\n');
}

runBackupRestoreTest();
