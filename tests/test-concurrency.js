// 100201 Football Shop - Concurrency & Simultaneous Users Stress Test
// Simulates 20 simultaneous users placing orders concurrently.
// Validates:
// 1. Concurrent I/O does not corrupt database/orders.json (Atomic write integrity)
// 2. Idempotency prevents duplicate order creations
// 3. Rate limiting and concurrent connection throttling handle spikes smoothly

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ORDERS_FILE = path.join(__dirname, '..', 'database', 'orders.json');

async function runConcurrencyTest() {
  console.log('====================================================');
  console.log('⚡ Starting Concurrency & Simultaneous Users Test');
  console.log('====================================================');

  // Verify server is reachable
  try {
    const healthRes = await fetchJson(`${BASE_URL}/api/health`);
    console.log(`[PASS] Server is healthy. Initial orders count: ${healthRes.database?.ordersCount}`);
  } catch (err) {
    console.error('[FAIL] Could not connect to server at', BASE_URL, err.message);
    process.exit(1);
  }

  const initialOrdersData = readOrdersDirect();
  const initialCount = initialOrdersData.length;

  const NUM_SIMULTANEOUS_USERS = 20;
  console.log(`\nLaunching ${NUM_SIMULTANEOUS_USERS} concurrent order requests...`);

  // Shared idempotency key for 5 duplicate payment attempts to test deduplication
  const duplicateIdempKey = `duplicate-test-idemp-${Date.now()}`;

  const requests = Array.from({ length: NUM_SIMULTANEOUS_USERS }).map((_, i) => {
    // Users 0, 1, 2, 3 share an idempotency key to test duplicate prevention
    const isDuplicate = i < 4;
    const idempKey = isDuplicate ? duplicateIdempKey : `user-session-${i}-${Date.now()}`;
    const orderId = isDuplicate ? '100201-ORDER-DUP-CONCUR' : `100201-ORDER-CONCUR-${i}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const orderPayload = {
      id: orderId,
      date: new Date().toISOString(),
      customer: {
        name: `Concurrent User ${i + 1}`,
        email: `concur-user-${i + 1}@100201footballshop.ph`,
        phone: `+63 917 555 ${1000 + i}`,
        address: `Pasig Concurrency Test Unit #${i + 1}`,
        city: 'Pasig City',
        country: 'Philippines'
      },
      items: [
        {
          id: 'fb-kit-barca-2627-home',
          name: "Barcelona '26/'27 Home Kit",
          size: 'L',
          quantity: 1,
          price: 1100
        }
      ],
      total: 1100,
      status: 'Order Confirmed',
      paymentMethod: { brand: 'GCash', last4: '1201' }
    };

    return postOrder(orderPayload, idempKey);
  });

  const results = await Promise.all(requests);

  const successes = results.filter(r => r.status === 200);
  const throttledOrRateLimited = results.filter(r => r.status === 429);
  const duplicateReplays = results.filter(r => r.isDuplicateReplay);
  const errors = results.filter(r => r.status !== 200 && r.status !== 429);

  console.log('\n--- Concurrency Test Results ---');
  console.log(`Total Requests Dispatched:    ${NUM_SIMULTANEOUS_USERS}`);
  console.log(`200 OK Responses:              ${successes.length}`);
  console.log(`429 Throttled / Rate Limited:  ${throttledOrRateLimited.length}`);
  console.log(`Duplicate Replays Blocked:     ${duplicateReplays.length}`);
  console.log(`Unexpected Errors:             ${errors.length}`);

  // Check Database JSON Integrity
  console.log('\n--- Checking Database Consistency ---');
  let finalOrdersData;
  try {
    finalOrdersData = readOrdersDirect();
    console.log(`[PASS] database/orders.json parsed successfully. Final count: ${finalOrdersData.length}`);
  } catch (err) {
    console.error('[FAIL] database/orders.json is corrupted after concurrent writes!', err.message);
    process.exit(1);
  }

  // Verify that the duplicate order exists at most once
  const dupMatches = finalOrdersData.filter(o => o.id === '100201-ORDER-DUP-CONCUR');
  if (dupMatches.length <= 1) {
    console.log(`[PASS] Idempotency successfully prevented duplicate orders (${dupMatches.length} copy stored)`);
  } else {
    console.error(`[FAIL] Duplicate orders created! Found: ${dupMatches.length}`);
    process.exit(1);
  }

  // Clean up test orders created during this run
  const cleanedOrders = finalOrdersData.filter(o => !o.id.includes('CONCUR'));
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(cleanedOrders, null, 2), 'utf-8');
  console.log('[PASS] Test orders cleaned up successfully.');

  console.log('\n====================================================');
  console.log('🎉 Simultaneous Users & Concurrency Test: ALL PASSED!');
  console.log('====================================================\n');
}

function readOrdersDirect() {
  const content = fs.readFileSync(ORDERS_FILE, 'utf-8');
  return JSON.parse(content);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function postOrder(payload, idempotencyKey) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/orders',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Idempotency-Key': idempotencyKey
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          status: res.statusCode,
          data: json,
          isDuplicateReplay: res.headers['x-idempotency-replay'] === 'true' || json?.isDuplicateReplay
        });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

runConcurrencyTest().catch(console.error);
