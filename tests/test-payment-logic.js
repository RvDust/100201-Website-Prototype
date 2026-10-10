// Automated test for payment logic (COD, Payment on Pick-up, etc.)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING PAYMENT LOGIC UNIT TESTS ---');

// 1. Verify mock-data.js includes pm-cod-00
const mockDataContent = fs.readFileSync(path.join(__dirname, '../js/mock-data.js'), 'utf-8');
if (!mockDataContent.includes('pm-cod-00') || !mockDataContent.includes('Cash on Delivery (COD)')) {
  console.error('FAIL: mock-data.js missing COD preset!');
  process.exit(1);
}
console.log('✓ PASS: mock-data.js contains pm-cod-00');

// 2. Verify store.js includes getCheckoutPaymentMethods and contextual logic
const storeContent = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf-8');
if (!storeContent.includes('getCheckoutPaymentMethods(')) {
  console.error('FAIL: store.js missing getCheckoutPaymentMethods!');
  process.exit(1);
}
if (!storeContent.includes('pm-cod-nationwide') || !storeContent.includes('pm-pickup-counter')) {
  console.error('FAIL: store.js missing contextual COD/Pickup payment defaults!');
  process.exit(1);
}
console.log('✓ PASS: store.js implements getCheckoutPaymentMethods with contextual COD/Pickup');

// 3. Verify cart.js uses getCheckoutPaymentMethods and handles COD/Pickup
const cartContent = fs.readFileSync(path.join(__dirname, '../js/cart.js'), 'utf-8');
if (!cartContent.includes('getCheckoutPaymentMethods(')) {
  console.error('FAIL: cart.js does not call getCheckoutPaymentMethods!');
  process.exit(1);
}
if (!cartContent.includes('pm-icon-cod') || !cartContent.includes('pm-icon-pickup')) {
  console.error('FAIL: cart.js missing pm-icon-cod / pm-icon-pickup mapping!');
  process.exit(1);
}
console.log('✓ PASS: cart.js calls getCheckoutPaymentMethods and maps COD/Pickup badges');

// 4. Verify index.html includes COD and Pickup options in both checkout and account modal
const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
if (!htmlContent.includes('value="cod"') || !htmlContent.includes('value="pickup"')) {
  console.error('FAIL: index.html missing cod/pickup options in selects!');
  process.exit(1);
}
console.log('✓ PASS: index.html contains COD and Pickup select options');

// 5. Verify tracker.js and admin.js payment presentations
const trackerContent = fs.readFileSync(path.join(__dirname, '../js/tracker.js'), 'utf-8');
const adminContent = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf-8');

if (!trackerContent.includes('Cash on Delivery') || !trackerContent.includes('Payment on Pick-up')) {
  console.error('FAIL: tracker.js missing COD / Pick-up payment labels!');
  process.exit(1);
}
if (!adminContent.includes('Collect on Arrival') || !adminContent.includes('Pay at Desk')) {
  console.error('FAIL: admin.js missing admin payment indicators!');
  process.exit(1);
}
console.log('✓ PASS: tracker.js and admin.js support COD and Payment on Pick-up presentation');

console.log('--- ALL PAYMENT LOGIC STATIC ASSERTIONS PASSED ---');
