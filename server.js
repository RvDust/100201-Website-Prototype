import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------------------------------------------------------
// 1. Environment & Path Initialization
// -----------------------------------------------------------------------------
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    } else {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.substring(0, idx).trim();
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      });
    }
  } catch (err) {
    console.warn('Could not load .env file:', err.message);
  }
}

const PORT = parseInt(process.env.PORT, 10) || 4173;
const DB_DIR = path.join(__dirname, 'database');
const LOGS_DIR = path.join(__dirname, 'logs');
const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');
const ACCESS_LOG = path.join(LOGS_DIR, 'access.log');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');
const EMAIL_LOG = path.join(LOGS_DIR, 'emails.log');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// 2. Performance, Safe I/O & Atomic Storage
// -----------------------------------------------------------------------------
function readJsonFile(filePath, defaultVal = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    logError('readJsonFile', e.message, { filePath });
  }
  return defaultVal;
}

function writeJsonFile(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (e) {
    logError('writeJsonFile', e.message, { filePath });
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    return false;
  }
}

function logAccess(req, statusCode, durationMs) {
  const entry = {
    timestamp: new Date().toISOString(),
    ip: getClientIp(req),
    method: req.method,
    url: req.url,
    status: statusCode,
    durationMs: Math.round(durationMs),
    userAgent: req.headers['user-agent'] || 'unknown'
  };
  try { fs.appendFileSync(ACCESS_LOG, JSON.stringify(entry) + '\n', 'utf-8'); } catch (_) {}
}

function logError(context, message, details = {}) {
  const entry = { timestamp: new Date().toISOString(), context, message, details };
  console.error(`[ERROR] [${context}]`, message, details);
  try { fs.appendFileSync(ERROR_LOG, JSON.stringify(entry) + '\n', 'utf-8'); } catch (_) {}
}

function logEmail(to, subject, status, preview = '') {
  const entry = {
    timestamp: new Date().toISOString(),
    to, subject, status,
    preview: preview.substring(0, 200)
  };
  try { fs.appendFileSync(EMAIL_LOG, JSON.stringify(entry) + '\n', 'utf-8'); } catch (_) {}
}

// -----------------------------------------------------------------------------
// 3. Email Service (Nodemailer + Gmail, graceful simulation fallback)
// -----------------------------------------------------------------------------
let mailer = null;

async function initMailer() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.log('[Email] Gmail not configured. Simulation mode active.');
    return null;
  }
  try {
    const require = createRequire(import.meta.url);
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });
    await transport.verify();
    console.log(`[Email] Gmail SMTP connected as ${gmailUser}`);
    return transport;
  } catch (err) {
    console.warn('[Email] Gmail SMTP failed:', err.message, '- Using simulation mode.');
    return null;
  }
}

async function sendEmail({ to, subject, html, text }) {
  const fromName = process.env.EMAIL_FROM_NAME || '100201 Football Shop';
  const fromAddr = process.env.EMAIL_FROM_ADDRESS || 'noreply@100201footballshop.ph';
  const fromFull = '"' + fromName + '" <' + fromAddr + '>';

  if (mailer) {
    try {
      const info = await mailer.sendMail({
        from: fromFull, to, subject, html,
        text: text || html.replace(/<[^>]+>/g, '')
      });
      console.log(`[Email] Sent to ${to}: ${subject}`);
      logEmail(to, subject, 'sent', text || subject);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Email] Failed to send to ${to}:`, err.message);
      logEmail(to, subject, 'failed', err.message);
    }
  }

  // Simulation mode
  const sim = { timestamp: new Date().toISOString(), mode: 'SIMULATED', from: fromFull, to, subject, body: (text || html).substring(0, 500) };
  console.log('[Email SIMULATED]', JSON.stringify(sim, null, 2));
  logEmail(to, subject, 'simulated', text || subject);
  return { success: true, simulated: true };
}

// --- Email Templates ---
function buildOrderConfirmEmail(order) {
  const isPickup = order.fulfillmentMode === 'pickup' || (order.carrier && /pick-?up|store|counter/i.test(order.carrier));
  const pm = order.paymentMethod || {};
  const isCod = pm.type === 'cod';
  const isPop = pm.type === 'pickup';

  const itemsRows = (order.items || []).map(item =>
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #2e1319">' + item.name +
    (item.customization ? ' <em style="color:#F43F5E">(' + item.customization + ')</em>' : '') +
    '</td><td style="padding:8px 12px;border-bottom:1px solid #2e1319;text-align:center">' + item.size +
    '</td><td style="padding:8px 12px;border-bottom:1px solid #2e1319;text-align:center">' + item.quantity +
    '</td><td style="padding:8px 12px;border-bottom:1px solid #2e1319;text-align:right">&#8369;' + (item.price * item.quantity).toLocaleString() + '</td></tr>'
  ).join('');

  const payNote = isCod
    ? 'Cash on Delivery (COD) — Prepare &#8369;' + (order.total || 0).toLocaleString() + ' exact cash for the courier rider.'
    : isPop
    ? 'Payment on Pick-up — Pay &#8369;' + (order.total || 0).toLocaleString() + ' at the store counter.'
    : (pm.brand || 'Digital Payment') + ' — Thank you for your payment of &#8369;' + (order.total || 0).toLocaleString() + '.';

  const fulfNote = isPickup
    ? 'Store Pick-up — 100201 Football Shop Counter, Ortigas Center, Pasig City. Claim Code: <strong style="color:#F43F5E">' + order.trackingNumber + '</strong>'
    : 'Nationwide Delivery — ' + order.carrier + ' | Waybill: ' + order.trackingNumber + ' | ETA: ' + order.estimatedDelivery;

  return {
    subject: 'Order Confirmed - ' + order.id + ' | 100201 Football Shop',
    html: '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0d1117;font-family:Arial,sans-serif;color:#e2e8f0">' +
      '<div style="max-width:600px;margin:0 auto;padding:32px 16px">' +
      '<div style="text-align:center;margin-bottom:24px"><div style="font-size:2rem;font-weight:900;color:#fff">100201</div>' +
      '<div style="font-size:0.75rem;color:#F43F5E;letter-spacing:3px">FOOTBALL SHOP</div></div>' +
      '<div style="background:#160e10;border:1px solid #2e1319;border-radius:12px;padding:28px;margin-bottom:16px">' +
      '<h1 style="text-align:center;color:#fff;font-size:1.3rem">' + (isPickup ? 'Pick-up Order Confirmed!' : 'Order Confirmed!') + '</h1>' +
      '<p style="text-align:center;color:#6b7280">Thank you, <strong style="color:#fff">' + (order.customer && order.customer.name) + '</strong>!</p>' +
      '<div style="background:#0d1117;border-radius:8px;padding:16px;text-align:center;margin:16px 0">' +
      '<div style="font-size:0.7rem;color:#6b7280;letter-spacing:2px;text-transform:uppercase">Order Reference</div>' +
      '<div style="font-size:1.3rem;font-weight:700;color:#F43F5E;letter-spacing:2px">' + order.id + '</div></div>' +
      '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#2e1319">' +
      '<th style="padding:8px 12px;text-align:left;font-size:0.7rem;color:#6b7280;text-transform:uppercase">Item</th>' +
      '<th style="padding:8px 12px;text-align:center;font-size:0.7rem;color:#6b7280;text-transform:uppercase">Size</th>' +
      '<th style="padding:8px 12px;text-align:center;font-size:0.7rem;color:#6b7280;text-transform:uppercase">Qty</th>' +
      '<th style="padding:8px 12px;text-align:right;font-size:0.7rem;color:#6b7280;text-transform:uppercase">Price</th>' +
      '</tr></thead><tbody>' + itemsRows + '</tbody></table>' +
      '<div style="border-top:2px solid #2e1319;padding-top:12px;margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280">Subtotal</span><span>&#8369;' + (order.subtotal || 0).toLocaleString() + '</span></div>' +
      (order.discount > 0 ? '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280">Discount</span><span style="color:#F43F5E">-&#8369;' + order.discount.toLocaleString() + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280">' + (isPickup ? 'Pick-up Fee' : 'Shipping') + '</span><span style="color:#F43F5E">' + (order.shipping === 0 ? 'FREE' : '&#8369;' + order.shipping.toLocaleString()) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.05rem;padding-top:8px;border-top:1px solid #2e1319">' +
      '<span>Total</span><span style="color:#F43F5E">&#8369;' + (order.total || 0).toLocaleString() + '</span></div></div></div>' +
      '<div style="background:#160e10;border:1px solid #2e1319;border-radius:12px;padding:20px;margin-bottom:16px">' +
      '<h3 style="margin:0 0 12px;font-size:0.85rem;color:#6b7280;text-transform:uppercase">Fulfillment</h3>' +
      '<p style="margin:0;font-size:0.9rem;line-height:1.6">' + fulfNote + '</p></div>' +
      '<div style="background:#160e10;border:1px solid #2e1319;border-radius:12px;padding:20px;margin-bottom:24px">' +
      '<h3 style="margin:0 0 12px;font-size:0.85rem;color:#6b7280;text-transform:uppercase">Payment</h3>' +
      '<p style="margin:0;font-size:0.9rem;line-height:1.6">' + payNote + '</p></div>' +
      '<div style="text-align:center;padding:16px 0;border-top:1px solid #2e1319">' +
      '<p style="color:#6b7280;font-size:0.8rem;margin:0">Questions? Contact us: <strong style="color:#F43F5E">@100201footballshop_</strong> on Instagram</p>' +
      '<p style="color:#374151;font-size:0.72rem;margin:8px 0 0">2026 100201 Football Shop - Pasig City, Philippines</p></div></div></body></html>',
    text: 'Order Confirmed! ' + order.id + '\n\nThank you, ' + (order.customer && order.customer.name) + '!\n\n' +
      'Items:\n' + (order.items || []).map(i => '- ' + i.name + ' (' + i.size + ') x' + i.quantity + ' = P' + (i.price * i.quantity).toLocaleString()).join('\n') +
      '\n\nTotal: P' + (order.total || 0).toLocaleString() + '\n\n' +
      (isPickup ? 'Pick-up at 100201 Store Counter. Claim Code: ' + order.trackingNumber : 'Delivery via ' + order.carrier + ' | Waybill: ' + order.trackingNumber) +
      '\n\nPayment: ' + (pm.brand || 'N/A')
  };
}

function buildStatusUpdateEmail(order, newStatus) {
  const isPickup = order.fulfillmentMode === 'pickup' || (order.carrier && /pick-?up|store|counter/i.test(order.carrier));
  let icon = '📦', msg = 'Order update', note = '';

  if (newStatus === 'Ready for Pick-up') {
    icon = '🟢'; msg = 'Your order is ready for pick-up!';
    note = 'Please bring a valid ID and your claim code when collecting at 100201 store counter, Ortigas Center.';
  } else if (newStatus === 'Out for Delivery') {
    icon = '🚚'; msg = 'Your order is out for delivery!';
    note = 'The courier rider is on the way to your address. Prepare exact cash if you chose COD.';
  } else if (newStatus === 'Shipped') {
    icon = '📤'; msg = 'Your order has been shipped!';
    note = 'Dispatched via ' + order.carrier + '. Waybill: ' + order.trackingNumber + '.';
  } else if (newStatus === 'Delivered' || newStatus === 'Picked Up') {
    icon = '✅'; msg = isPickup ? 'Order picked up!' : 'Order delivered!';
    note = 'Thank you for choosing 100201 Football Shop!';
  } else if (newStatus === 'Cancelled') {
    icon = '❌'; msg = 'Order cancelled';
    note = 'Your order has been cancelled. Contact us for more information.';
  } else {
    msg = 'Order status: ' + newStatus;
    note = 'Log in to track your order in real-time.';
  }

  return {
    subject: icon + ' ' + msg + ' - ' + order.id + ' | 100201 Football Shop',
    html: '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0d1117;font-family:Arial,sans-serif;color:#e2e8f0">' +
      '<div style="max-width:600px;margin:0 auto;padding:32px 16px">' +
      '<div style="text-align:center;margin-bottom:24px"><div style="font-size:2rem;font-weight:900;color:#fff">100201</div>' +
      '<div style="font-size:0.75rem;color:#F43F5E;letter-spacing:3px">FOOTBALL SHOP</div></div>' +
      '<div style="background:#160e10;border:1px solid #2e1319;border-radius:12px;padding:28px;text-align:center;margin-bottom:16px">' +
      '<div style="font-size:3rem;margin-bottom:12px">' + icon + '</div>' +
      '<h1 style="margin:0 0 8px;font-size:1.2rem;color:#fff">' + msg + '</h1>' +
      '<p style="color:#6b7280;margin:0 0 16px">Order <strong style="color:#F43F5E">' + order.id + '</strong></p>' +
      '<p style="color:#e2e8f0;font-size:0.9rem;line-height:1.6;margin:0">' + note + '</p></div>' +
      '<div style="background:#160e10;border:1px solid #2e1319;border-radius:12px;padding:20px;margin-bottom:20px">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:8px">' +
      '<span style="color:#6b7280;font-size:0.85rem">Customer</span>' +
      '<span style="font-size:0.85rem">' + (order.customer && order.customer.name) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:8px">' +
      '<span style="color:#6b7280;font-size:0.85rem">' + (isPickup ? 'Claim Code' : 'Waybill') + '</span>' +
      '<span style="color:#F43F5E;font-weight:700;font-size:0.85rem">' + order.trackingNumber + '</span></div>' +
      '<div style="display:flex;justify-content:space-between">' +
      '<span style="color:#6b7280;font-size:0.85rem">Total</span>' +
      '<span style="font-size:0.85rem">&#8369;' + (order.total || 0).toLocaleString() + '</span></div></div>' +
      '<div style="text-align:center;padding:16px 0;border-top:1px solid #2e1319">' +
      '<p style="color:#6b7280;font-size:0.8rem;margin:0">Contact: <strong style="color:#F43F5E">@100201footballshop_</strong> on Instagram</p>' +
      '<p style="color:#374151;font-size:0.72rem;margin:8px 0 0">2026 100201 Football Shop - Pasig City, Philippines</p></div></div></body></html>',
    text: msg + '\n\nOrder: ' + order.id + '\nCustomer: ' + (order.customer && order.customer.name) + '\n' + note + '\n\nTotal: P' + (order.total || 0).toLocaleString()
  };
}

function buildOtpEmail(name, otp) {
  const expiryMin = process.env.OTP_EXPIRY_MINUTES || 10;
  return {
    subject: 'Your 100201 Verification Code: ' + otp,
    html: '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0d1117;font-family:Arial,sans-serif;color:#e2e8f0">' +
      '<div style="max-width:480px;margin:0 auto;padding:32px 16px">' +
      '<div style="text-align:center;margin-bottom:24px"><div style="font-size:2rem;font-weight:900;color:#fff">100201</div>' +
      '<div style="font-size:0.75rem;color:#F43F5E;letter-spacing:3px">FOOTBALL SHOP</div></div>' +
      '<div style="background:#160e10;border:1px solid #2e1319;border-radius:12px;padding:32px;text-align:center">' +
      '<div style="font-size:2.5rem;margin-bottom:12px">🔐</div>' +
      '<h1 style="margin:0 0 8px;font-size:1.2rem;color:#fff">Verify Your Account</h1>' +
      '<p style="color:#6b7280;margin:0 0 24px">Hi <strong style="color:#fff">' + name + '</strong>, use the code below to verify your account.</p>' +
      '<div style="background:#0d1117;border:2px solid #F43F5E;border-radius:12px;padding:20px;margin-bottom:20px">' +
      '<div style="font-size:2.5rem;font-weight:900;letter-spacing:12px;color:#F43F5E;font-family:monospace">' + otp + '</div></div>' +
      '<p style="color:#6b7280;font-size:0.85rem;margin:0">This code expires in ' + expiryMin + ' minutes.<br>Do not share this code.</p></div>' +
      '<div style="text-align:center;padding:16px 0;border-top:1px solid #2e1319;margin-top:20px">' +
      '<p style="color:#374151;font-size:0.72rem;margin:0">2026 100201 Football Shop - Pasig City, Philippines</p></div></div></body></html>',
    text: 'Your 100201 Football Shop verification code is: ' + otp + '\n\nThis code expires in ' + expiryMin + ' minutes.'
  };
}

// OTP Store (in-memory, keyed by email lowercase)
const otpStore = new Map();

function generateOtp() {
  const len = parseInt(process.env.OTP_LENGTH, 10) || 6;
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
}

// -----------------------------------------------------------------------------
// 4. Security, Rate Limiting, Quotas & Request Throttling
// -----------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_GENERAL_REQ_PER_WINDOW = 120;
const MAX_WRITE_REQ_PER_WINDOW = 20;
const DAILY_QUOTA_PER_IP = 2500;
const MAX_CONCURRENT_PER_IP = 20;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const rateLimitStore = new Map();
const activeConnections = new Map();
const idempotencyStore = new Map();

const serverStartTime = Date.now();
const metrics = {
  totalRequests: 0,
  rateLimitBlocked: 0,
  errors4xx: 0,
  errors5xx: 0,
  statusCodes: {}
};

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(req, res, isWriteOperation = false) {
  const ip = getClientIp(req);
  const now = Date.now();

  let clientData = rateLimitStore.get(ip);
  if (!clientData || now > clientData.windowReset) {
    clientData = {
      windowReset: now + RATE_LIMIT_WINDOW_MS,
      generalCount: 0,
      writeCount: 0,
      dayReset: clientData?.dayReset && now < clientData.dayReset ? clientData.dayReset : now + 24 * 60 * 60 * 1000,
      dailyCount: clientData?.dayReset && now < clientData.dayReset ? clientData.dailyCount : 0
    };
    rateLimitStore.set(ip, clientData);
  }

  clientData.generalCount++;
  clientData.dailyCount++;
  if (isWriteOperation) clientData.writeCount++;

  const limit = isWriteOperation ? MAX_WRITE_REQ_PER_WINDOW : MAX_GENERAL_REQ_PER_WINDOW;
  const currentCount = isWriteOperation ? clientData.writeCount : clientData.generalCount;
  const remaining = Math.max(0, limit - currentCount);
  const resetSeconds = Math.ceil((clientData.windowReset - now) / 1000);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (clientData.dailyCount > DAILY_QUOTA_PER_IP) {
    metrics.rateLimitBlocked++;
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': 3600 });
    res.end(JSON.stringify({ success: false, error: 'Daily API usage quota exceeded.', code: 'QUOTA_EXCEEDED' }));
    return false;
  }

  if (currentCount > limit) {
    metrics.rateLimitBlocked++;
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': resetSeconds });
    res.end(JSON.stringify({ success: false, error: 'Too many requests.', code: 'RATE_LIMITED', retryAfterSeconds: resetSeconds }));
    return false;
  }

  const currentActive = activeConnections.get(ip) || 0;
  if (currentActive >= MAX_CONCURRENT_PER_IP) {
    metrics.rateLimitBlocked++;
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': 2 });
    res.end(JSON.stringify({ success: false, error: 'Too many concurrent requests.', code: 'THROTTLED' }));
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// 5. HTTP Server Core & MIME Configuration
// -----------------------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const startTime = performance.now();
  const ip = getClientIp(req);

  activeConnections.set(ip, (activeConnections.get(ip) || 0) + 1);

  const onFinish = () => {
    const active = activeConnections.get(ip) || 1;
    if (active <= 1) activeConnections.delete(ip);
    else activeConnections.set(ip, active - 1);
    metrics.totalRequests++;
    const sc = res.statusCode;
    metrics.statusCodes[sc] = (metrics.statusCodes[sc] || 0) + 1;
    if (sc >= 400 && sc < 500) metrics.errors4xx++;
    if (sc >= 500) metrics.errors5xx++;
    logAccess(req, sc, performance.now() - startTime);
  };

  res.on('finish', onFinish);
  res.on('close', () => { if (!res.writableEnded) onFinish(); });

  req.setTimeout(10000, () => {
    logError('Timeout', 'Request timed out', { ip, url: req.url });
    if (!res.headersSent) {
      res.writeHead(408, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Request timeout', code: 'TIMEOUT' }));
    }
    req.destroy();
  });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match, Idempotency-Key');
  res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURI(parsedUrl.pathname);

  const isWriteOp = (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && pathname.startsWith('/api/');
  if (!checkRateLimit(req, res, isWriteOp)) return;

  // ---------------------------------------------------------------------------
  // 6. API Endpoints
  // ---------------------------------------------------------------------------

  function readBodyWithLimit(callback) {
    const contentLength = parseInt(req.headers['content-length'], 10);
    if (contentLength > MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Payload Too Large', code: 'PAYLOAD_TOO_LARGE' }));
      req.destroy();
      return;
    }
    let body = '';
    let bytesReceived = 0;
    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Payload Too Large', code: 'PAYLOAD_TOO_LARGE' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try { callback(null, JSON.parse(body || '{}')); }
      catch (err) { callback(err); }
    });
  }

  function sendJsonWithETag(statusCode, data) {
    const jsonStr = JSON.stringify(data);
    const etag = '"' + crypto.createHash('md5').update(jsonStr).digest('hex') + '"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'ETag': etag, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' });
      res.end();
      return;
    }
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'ETag': etag,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
    });
    res.end(jsonStr);
  }

  function sendJson(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }

  // --- /api/health ---
  if (pathname === '/api/health' && req.method === 'GET') {
    const prods = readJsonFile(PRODUCTS_FILE, []);
    const orders = readJsonFile(ORDERS_FILE, []);
    const mem = process.memoryUsage();
    sendJson(200, {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      systemTime: new Date().toISOString(),
      emailMode: mailer ? 'gmail' : 'simulation',
      memoryMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024))
      },
      database: { productsCount: prods.length, ordersCount: orders.length, storageHealthy: true }
    });
    return;
  }

  // --- /api/metrics ---
  if (pathname === '/api/metrics' && req.method === 'GET') {
    sendJson(200, {
      metrics,
      activeConnectionsCount: activeConnections.get(ip) || 0,
      rateLimitEntriesTracked: rateLimitStore.size,
      uptimeSeconds: Math.round((Date.now() - serverStartTime) / 1000)
    });
    return;
  }

  // --- /api/email/logs ---
  if (pathname === '/api/email/logs' && req.method === 'GET') {
    try {
      const logs = fs.existsSync(EMAIL_LOG)
        ? fs.readFileSync(EMAIL_LOG, 'utf-8')
            .trim().split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean).slice(-50)
        : [];
      sendJson(200, { success: true, emailMode: mailer ? 'gmail' : 'simulation', logs });
    } catch (e) {
      sendJson(200, { success: true, logs: [] });
    }
    return;
  }

  // --- /api/otp/send ---
  if (pathname === '/api/otp/send' && req.method === 'POST') {
    readBodyWithLimit(async (err, payload) => {
      if (err) { sendJson(400, { success: false, error: 'Invalid JSON payload' }); return; }
      const { email, name } = payload;
      if (!email || !name) { sendJson(400, { success: false, error: 'Email and name are required.' }); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        sendJson(400, { success: false, error: 'Invalid email address format.' });
        return;
      }
      const otp = generateOtp();
      const expiryMs = (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10) * 60 * 1000;
      otpStore.set(email.toLowerCase().trim(), { otp, expiresAt: Date.now() + expiryMs, name: name.trim() });
      const emailData = buildOtpEmail(name.trim(), otp);
      const result = await sendEmail({ to: email, ...emailData });
      if (result.simulated) {
        sendJson(200, { success: true, simulated: true, message: 'Verification code sent (simulation mode)', devOtp: otp });
      } else {
        sendJson(200, { success: true, message: 'Verification code sent to ' + email });
      }
    });
    return;
  }

  // --- /api/otp/verify ---
  if (pathname === '/api/otp/verify' && req.method === 'POST') {
    readBodyWithLimit((err, payload) => {
      if (err) { sendJson(400, { success: false, error: 'Invalid JSON payload' }); return; }
      const { email, otp } = payload;
      if (!email || !otp) { sendJson(400, { success: false, error: 'Email and OTP are required.' }); return; }
      const cleanEmail = email.toLowerCase().trim();
      const stored = otpStore.get(cleanEmail);
      if (!stored) { sendJson(400, { success: false, error: 'No verification code found. Please request a new one.' }); return; }
      if (Date.now() > stored.expiresAt) {
        otpStore.delete(cleanEmail);
        sendJson(400, { success: false, error: 'Verification code expired. Please request a new one.' });
        return;
      }
      if (stored.otp !== otp.trim()) {
        sendJson(400, { success: false, error: 'Incorrect verification code. Please try again.' });
        return;
      }
      otpStore.delete(cleanEmail);
      sendJson(200, { success: true, message: 'Email verified successfully!' });
    });
    return;
  }

  // --- /api/email/order-confirm ---
  if (pathname === '/api/email/order-confirm' && req.method === 'POST') {
    readBodyWithLimit(async (err, payload) => {
      if (err) { sendJson(400, { success: false, error: 'Invalid JSON payload' }); return; }
      const { order } = payload;
      if (!order || !order.id || !(order.customer && order.customer.email)) {
        sendJson(400, { success: false, error: 'Valid order with customer email required.' });
        return;
      }
      const emailData = buildOrderConfirmEmail(order);
      const result = await sendEmail({ to: order.customer.email, ...emailData });
      sendJson(200, { success: true, ...result });
    });
    return;
  }

  // --- /api/email/status-update ---
  if (pathname === '/api/email/status-update' && req.method === 'POST') {
    readBodyWithLimit(async (err, payload) => {
      if (err) { sendJson(400, { success: false, error: 'Invalid JSON payload' }); return; }
      const { order, newStatus } = payload;
      if (!order || !newStatus || !(order.customer && order.customer.email)) {
        sendJson(400, { success: false, error: 'Order and newStatus required.' });
        return;
      }
      const notifyStatuses = ['Shipped', 'Out for Delivery', 'Ready for Pick-up', 'Picked Up', 'Delivered', 'Cancelled'];
      if (!notifyStatuses.includes(newStatus)) {
        sendJson(200, { success: true, skipped: true, reason: 'Status does not trigger notification.' });
        return;
      }
      const emailData = buildStatusUpdateEmail(order, newStatus);
      const result = await sendEmail({ to: order.customer.email, ...emailData });
      sendJson(200, { success: true, ...result });
    });
    return;
  }

  // --- /api/products ---
  if (pathname === '/api/products') {
    if (req.method === 'GET') {
      const prods = readJsonFile(PRODUCTS_FILE, []);
      sendJsonWithETag(200, prods);
      return;
    }
    if (req.method === 'POST') {
      readBodyWithLimit((err, payload) => {
        if (err) { sendJson(400, { success: false, error: 'Invalid JSON payload' }); return; }
        let prods = readJsonFile(PRODUCTS_FILE, []);
        if (Array.isArray(payload)) {
          prods = payload;
        } else if (payload && payload.id) {
          const idx = prods.findIndex(p => p.id === payload.id);
          if (idx > -1) prods[idx] = { ...prods[idx], ...payload };
          else prods.unshift(payload);
        }
        writeJsonFile(PRODUCTS_FILE, prods);
        sendJson(200, { success: true, products: prods });
      });
      return;
    }
  }

  // --- /api/orders ---
  if (pathname === '/api/orders') {
    if (req.method === 'GET') {
      const orders = readJsonFile(ORDERS_FILE, []);
      sendJsonWithETag(200, orders);
      return;
    }
    if (req.method === 'POST') {
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
        const cached = idempotencyStore.get(idempotencyKey);
        const allOrders = readJsonFile(ORDERS_FILE, []);
        const matched = allOrders.find(o => o.id === cached.orderId);
        if (matched) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Idempotency-Replay': 'true' });
          res.end(JSON.stringify({ success: true, order: matched, isDuplicateReplay: true }));
          return;
        }
      }
      readBodyWithLimit((err, payload) => {
        if (err) { sendJson(400, { success: false, error: 'Invalid JSON payload' }); return; }
        let orders = readJsonFile(ORDERS_FILE, []);
        if (Array.isArray(payload)) {
          orders = payload;
        } else if (payload && payload.id) {
          const idx = orders.findIndex(o => o.id === payload.id);
          if (idx > -1) orders[idx] = { ...orders[idx], ...payload };
          else orders.unshift(payload);
          if (idempotencyKey) {
            idempotencyStore.set(idempotencyKey, { orderId: payload.id, timestamp: Date.now() });
          }
        }
        writeJsonFile(ORDERS_FILE, orders);
        sendJson(200, { success: true, orders });
      });
      return;
    }
  }

  // --- /api/assets/products ---
  if (pathname === '/api/assets/products' && req.method === 'GET') {
    const assetsDir = path.join(__dirname, 'assets', 'products');
    try {
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir)
          .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
          .map(f => 'assets/products/' + f);
        sendJsonWithETag(200, files);
        return;
      }
    } catch (e) {
      logError('assets/products', e.message);
    }
    sendJson(200, []);
    return;
  }

  // ---------------------------------------------------------------------------
  // 7. Static Asset Serving with ETag & Security Bounds
  // ---------------------------------------------------------------------------
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const fileEtag = '"' + stats.mtimeMs.toString(36) + '-' + stats.size.toString(36) + '"';
    if (req.headers['if-none-match'] === fileEtag) {
      res.writeHead(304, { 'ETag': fileEtag, 'Cache-Control': 'public, max-age=300' });
      res.end();
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'ETag': fileEtag,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300, stale-while-revalidate=600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Initialize mailer then start server
initMailer().then(transport => {
  mailer = transport;
  server.listen(PORT, '127.0.0.1', () => {
    console.log('[100201 Server] Running at http://127.0.0.1:' + PORT);
    console.log('[100201 Server] Email mode: ' + (mailer ? 'Gmail SMTP' : 'Simulation (logged to file)'));
  });
});

