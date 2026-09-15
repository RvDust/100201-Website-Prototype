import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

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
          if (!process.env[key]) {
            process.env[key] = val;
          }
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

// Ensure database and logs directories exist
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

// Atomic file writing via temporary file swap to eliminate data corruption
function writeJsonFile(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (e) {
    logError('writeJsonFile', e.message, { filePath });
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
    return false;
  }
}

// Structured JSON file logger
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
  try {
    fs.appendFileSync(ACCESS_LOG, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (_) {}
}

function logError(context, message, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    message,
    details
  };
  console.error(`[ERROR] [${context}]`, message, details);
  try {
    fs.appendFileSync(ERROR_LOG, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (_) {}
}

// -----------------------------------------------------------------------------
// 3. Security, Rate Limiting, Quotas & Request Throttling
// -----------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_GENERAL_REQ_PER_WINDOW = 120; // 120 req / min
const MAX_WRITE_REQ_PER_WINDOW = 20;    // 20 write req / min
const DAILY_QUOTA_PER_IP = 2500;        // 2500 req / day
const MAX_CONCURRENT_PER_IP = 20;       // Max 20 simultaneous active connections
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB upload size limit

// In-memory rate limiting tracking
const rateLimitStore = new Map();
const activeConnections = new Map();
const idempotencyStore = new Map(); // Idempotency key tracking: key -> { orderId, timestamp }

// Metrics & Uptime tracking
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
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
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

  // Increment counters
  clientData.generalCount++;
  clientData.dailyCount++;
  if (isWriteOperation) clientData.writeCount++;

  const limit = isWriteOperation ? MAX_WRITE_REQ_PER_WINDOW : MAX_GENERAL_REQ_PER_WINDOW;
  const currentCount = isWriteOperation ? clientData.writeCount : clientData.generalCount;
  const remaining = Math.max(0, limit - currentCount);
  const resetSeconds = Math.ceil((clientData.windowReset - now) / 1000);

  // Standard rate limit headers
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  // Daily quota check
  if (clientData.dailyCount > DAILY_QUOTA_PER_IP) {
    metrics.rateLimitBlocked++;
    res.writeHead(429, {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': 3600
    });
    res.end(JSON.stringify({
      success: false,
      error: 'Daily API usage quota exceeded for this IP. Please try again tomorrow.',
      code: 'QUOTA_EXCEEDED'
    }));
    return false;
  }

  // Window rate limit check
  if (currentCount > limit) {
    metrics.rateLimitBlocked++;
    res.writeHead(429, {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': resetSeconds
    });
    res.end(JSON.stringify({
      success: false,
      error: 'Too many requests. Rate limit exceeded, please slow down.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: resetSeconds
    }));
    return false;
  }

  // Request Throttling: Max concurrent connections per IP
  const currentActive = activeConnections.get(ip) || 0;
  if (currentActive >= MAX_CONCURRENT_PER_IP) {
    metrics.rateLimitBlocked++;
    res.writeHead(429, {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': 2
    });
    res.end(JSON.stringify({
      success: false,
      error: 'Too many concurrent requests. Request throttled.',
      code: 'THROTTLED'
    }));
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// 4. HTTP Server Core & MIME Configuration
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

  // Track active connection
  activeConnections.set(ip, (activeConnections.get(ip) || 0) + 1);

  // Connection completion tracking
  const onFinish = () => {
    const active = activeConnections.get(ip) || 1;
    if (active <= 1) {
      activeConnections.delete(ip);
    } else {
      activeConnections.set(ip, active - 1);
    }

    // Metrics tracking
    metrics.totalRequests++;
    const sc = res.statusCode;
    metrics.statusCodes[sc] = (metrics.statusCodes[sc] || 0) + 1;
    if (sc >= 400 && sc < 500) metrics.errors4xx++;
    if (sc >= 500) metrics.errors5xx++;

    logAccess(req, sc, performance.now() - startTime);
  };

  res.on('finish', onFinish);
  res.on('close', () => {
    if (!res.writableEnded) onFinish();
  });

  // 10-second socket timeout protection (prevents Slowloris attack)
  req.setTimeout(10000, () => {
    logError('Timeout', 'Request timed out after 10s', { ip, url: req.url });
    if (!res.headersSent) {
      res.writeHead(408, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Request timeout', code: 'TIMEOUT' }));
    }
    req.destroy();
  });

  // CORS Headers
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

  // Determine if this is a sensitive write operation
  const isWriteOp = (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && pathname.startsWith('/api/');

  // Enforce Rate Limiting & Quotas
  if (!checkRateLimit(req, res, isWriteOp)) {
    return;
  }

  // ---------------------------------------------------------------------------
  // 5. API Endpoints
  // ---------------------------------------------------------------------------

  // --- API: /api/health (Uptime Monitoring) ---
  if (pathname === '/api/health' && req.method === 'GET') {
    const products = readJsonFile(PRODUCTS_FILE, []);
    const orders = readJsonFile(ORDERS_FILE, []);
    const mem = process.memoryUsage();

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      systemTime: new Date().toISOString(),
      memoryMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024))
      },
      database: {
        productsCount: products.length,
        ordersCount: orders.length,
        storageHealthy: true
      }
    }));
    return;
  }

  // --- API: /api/metrics (Observability & Health Stats) ---
  if (pathname === '/api/metrics' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({
      metrics,
      activeConnectionsCount: activeConnections.get(ip) || 0,
      rateLimitEntriesTracked: rateLimitStore.size,
      uptimeSeconds: Math.round((Date.now() - serverStartTime) / 1000)
    }));
    return;
  }

  // Helper for reading streamed JSON body with strict size limit (5MB)
  function readBodyWithLimit(callback) {
    const contentLength = parseInt(req.headers['content-length'], 10);
    if (contentLength > MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Payload Too Large (5MB limit)', code: 'PAYLOAD_TOO_LARGE' }));
      req.destroy();
      return;
    }

    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Payload Too Large (5MB limit)', code: 'PAYLOAD_TOO_LARGE' }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        callback(null, parsed);
      } catch (err) {
        callback(err);
      }
    });
  }

  // Helper for ETag & Caching
  function sendJsonWithETag(statusCode, data) {
    const jsonStr = JSON.stringify(data);
    const etag = `"${crypto.createHash('md5').update(jsonStr).digest('hex')}"`;

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, {
        'ETag': etag,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
      });
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

  // --- API: /api/products ---
  if (pathname === '/api/products') {
    if (req.method === 'GET') {
      const prods = readJsonFile(PRODUCTS_FILE, []);
      sendJsonWithETag(200, prods);
      return;
    }

    if (req.method === 'POST') {
      readBodyWithLimit((err, payload) => {
        if (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
          return;
        }

        let prods = readJsonFile(PRODUCTS_FILE, []);
        if (Array.isArray(payload)) {
          prods = payload;
        } else if (payload && payload.id) {
          const idx = prods.findIndex(p => p.id === payload.id);
          if (idx > -1) {
            prods[idx] = { ...prods[idx], ...payload };
          } else {
            prods.unshift(payload);
          }
        }
        writeJsonFile(PRODUCTS_FILE, prods);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, products: prods }));
      });
      return;
    }
  }

  // --- API: /api/orders ---
  if (pathname === '/api/orders') {
    if (req.method === 'GET') {
      const orders = readJsonFile(ORDERS_FILE, []);
      sendJsonWithETag(200, orders);
      return;
    }

    if (req.method === 'POST') {
      // Check for Idempotency-Key Header to prevent duplicate orders/payments
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
        const cached = idempotencyStore.get(idempotencyKey);
        const allOrders = readJsonFile(ORDERS_FILE, []);
        const matched = allOrders.find(o => o.id === cached.orderId);
        if (matched) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Idempotency-Replay': 'true'
          });
          res.end(JSON.stringify({ success: true, order: matched, isDuplicateReplay: true }));
          return;
        }
      }

      readBodyWithLimit((err, payload) => {
        if (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
          return;
        }

        let orders = readJsonFile(ORDERS_FILE, []);
        if (Array.isArray(payload)) {
          orders = payload;
        } else if (payload && payload.id) {
          const idx = orders.findIndex(o => o.id === payload.id);
          if (idx > -1) {
            orders[idx] = { ...orders[idx], ...payload };
          } else {
            orders.unshift(payload);
          }

          // Register idempotency key
          if (idempotencyKey) {
            idempotencyStore.set(idempotencyKey, {
              orderId: payload.id,
              timestamp: Date.now()
            });
          }
        }
        writeJsonFile(ORDERS_FILE, orders);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, orders }));
      });
      return;
    }
  }

  // --- API: /api/assets/products (Dynamic Photo Discovery) ---
  if (pathname === '/api/assets/products' && req.method === 'GET') {
    const assetsDir = path.join(__dirname, 'assets', 'products');
    try {
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir)
          .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
          .map(f => `assets/products/${f}`);
        sendJsonWithETag(200, files);
        return;
      }
    } catch (e) {
      logError('assets/products', e.message);
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify([]));
    return;
  }

  // ---------------------------------------------------------------------------
  // 6. Static Asset Serving with ETag & Security Bounds
  // ---------------------------------------------------------------------------
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);

  // Security check: Directory traversal prevention
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

    // Static Asset ETag calculation
    const fileEtag = `"${stats.mtimeMs.toString(36)}-${stats.size.toString(36)}"`;
    if (req.headers['if-none-match'] === fileEtag) {
      res.writeHead(304, {
        'ETag': fileEtag,
        'Cache-Control': 'public, max-age=300'
      });
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[100201 Server] Protected Production Engine running at http://127.0.0.1:${PORT}`);
});
