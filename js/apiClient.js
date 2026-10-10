// 100201 Football Shop - Resilient API Client
// Provides Timeout Handling (AbortController), Exponential Backoff Retries,
// Idempotency Keys, In-Memory Caching, and Offline Detection.

export class ApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultTimeoutMs = options.timeoutMs || 8000;
    this.maxRetries = options.maxRetries ?? 2;
    this.cache = new Map(); // url -> { data, etag, timestamp }
    this.cacheTtlMs = options.cacheTtlMs || 60 * 1000; // 1 minute
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        window.showToast?.('Connection restored. You are back online.', 'success');
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        window.showToast?.('Network disconnected. Running in offline mode.', 'warning');
      });
    }
  }

  generateIdempotencyKey() {
    return `100201-idemp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;

    // Check in-memory cache for GET requests
    if (isGet && !options.skipCache) {
      const cached = this.cache.get(url);
      if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
        return { ok: true, status: 200, data: cached.data, fromCache: true };
      }
    }

    let lastError = null;
    const maxAttempts = isGet ? this.maxRetries + 1 : 1; // Never automatically retry non-idempotent writes unless requested

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };

        // Attach ETag if present in cache
        if (isGet && this.cache.has(url)) {
          const cached = this.cache.get(url);
          if (cached.etag) {
            headers['If-None-Match'] = cached.etag;
          }
        }

        // Attach Idempotency Key for write operations if not already provided
        if (!isGet && !headers['Idempotency-Key']) {
          headers['Idempotency-Key'] = this.generateIdempotencyKey();
        }

        const fetchOptions = {
          method,
          headers,
          signal: controller.signal
        };

        if (options.body) {
          fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }

        const res = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // 304 Not Modified
        if (res.status === 304 && this.cache.has(url)) {
          const cached = this.cache.get(url);
          cached.timestamp = Date.now();
          return { ok: true, status: 200, data: cached.data, fromCache: true };
        }

        // 429 Rate Limited
        if (res.status === 429) {
          const retrySec = res.headers.get('Retry-After') || 5;
          const errData = await res.json().catch(() => ({}));
          window.showToast?.(`Rate limit reached: ${errData.error || 'Please wait a moment.'}`, 'warning');
          return {
            ok: false,
            status: 429,
            error: errData.error || 'Too many requests. Please slow down.',
            retryAfterSeconds: parseInt(retrySec, 10),
            code: 'RATE_LIMITED'
          };
        }

        // 413 Payload Too Large
        if (res.status === 413) {
          window.showToast?.('Payload too large. Max 5MB allowed.', 'error');
          return { ok: false, status: 413, error: 'File or payload too large', code: 'PAYLOAD_TOO_LARGE' };
        }

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: data?.error || `Request failed with status ${res.status}`,
            data
          };
        }

        // Store in cache if GET
        if (isGet) {
          this.cache.set(url, {
            data,
            etag: res.headers.get('ETag') || null,
            timestamp: Date.now()
          });
        }

        return { ok: true, status: res.status, data };

      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;

        const isTimeout = err.name === 'AbortError';
        if (isTimeout) {
          console.warn(`[ApiClient] Request to ${url} timed out after ${timeoutMs}ms (attempt ${attempt}/${maxAttempts})`);
        }

        // Wait before retrying with exponential backoff
        if (attempt < maxAttempts) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 200, 4000);
          await new Promise(r => setTimeout(r, backoffDelay));
        }
      }
    }

    const isTimeout = lastError?.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 408 : 0,
      error: isTimeout ? 'Request timed out. Please check your connection.' : (lastError?.message || 'Network request failed'),
      isTimeout,
      isOffline: !this.isOnline
    };
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  clearCache() {
    this.cache.clear();
  }

  // --- Email Service Methods ---

  async sendOtp(email, name) {
    return this.post('/api/otp/send', { email, name });
  }

  async verifyOtp(email, otp) {
    return this.post('/api/otp/verify', { email, otp });
  }

  async sendOrderConfirmEmail(order) {
    return this.post('/api/email/order-confirm', { order });
  }

  async sendStatusUpdateEmail(order, newStatus) {
    return this.post('/api/email/status-update', { order, newStatus });
  }
}

export const apiClient = new ApiClient();
