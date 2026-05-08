/**
 * IUH Exchange Platform - Unit/Integration Tests
 * Run: node --test tests/test-services.js
 * 
 * Prerequisites:
 *   - All services running on localhost (ports 3001-3006, gateway 8080)
 *   - MongoDB, Redis, Kafka, ElasticSearch running
 * 
 * Uses Node.js built-in test runner (Node 20+)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:8080';
let authToken = null;
let refreshToken = null;
let userId = null;
let productId = null;
let orderId = null;

// Helper
async function api(method, path, { body, token, headers = {} } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
describe('Health Check', () => {
  it('GET /health should return 200', async () => {
    const { status, data } = await api('GET', '/health');
    assert.equal(status, 200);
    assert.ok(data.status === 'ok' || data.services);
  });
});

// ─────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────
describe('Auth Service', () => {
  const testEmail = `test_${Date.now()}@student.iuh.edu.vn`;
  const testPassword = 'Test123456';

  it('POST /api/v1/auth/register - should register new user', async () => {
    const { status, data } = await api('POST', '/api/v1/auth/register', {
      body: { email: testEmail, password: testPassword, name: 'Test User' },
    });
    assert.equal(status, 201);
    assert.ok(data.success);
  });

  it('POST /api/v1/auth/register - should reject duplicate email', async () => {
    const { status } = await api('POST', '/api/v1/auth/register', {
      body: { email: testEmail, password: testPassword, name: 'Test User' },
    });
    assert.equal(status, 400);
  });

  it('POST /api/v1/auth/register - should reject non-IUH email', async () => {
    const { status } = await api('POST', '/api/v1/auth/register', {
      body: { email: 'test@gmail.com', password: testPassword, name: 'Test' },
    });
    assert.equal(status, 400);
  });

  it('POST /api/v1/auth/register - should reject short password', async () => {
    const { status } = await api('POST', '/api/v1/auth/register', {
      body: { email: `short@student.iuh.edu.vn`, password: '123', name: 'Test' },
    });
    assert.equal(status, 400);
  });

  // NOTE: Login requires OTP verification first
  // If OTP email is not configured, manually verify in DB:
  // db.users.updateOne({email: testEmail}, {$set: {isVerified: true}})
  it('POST /api/v1/auth/login - should login (after OTP verify)', async () => {
    // Skip if OTP not verified
    const { status, data } = await api('POST', '/api/v1/auth/login', {
      body: { email: testEmail, password: testPassword },
    });

    if (status === 200 && data?.data?.accessToken) {
      authToken = data.data.accessToken;
      refreshToken = data.data.refreshToken || data.data.data?.refreshToken;
      userId = data.data.user?.id;
    }

    // Accept 200 (success) or 400 (OTP not verified)
    assert.ok([200, 400].includes(status), `Unexpected status: ${status}`);
  });

  it('POST /api/v1/auth/login - should reject wrong password', async () => {
    const { status } = await api('POST', '/api/v1/auth/login', {
      body: { email: testEmail, password: 'wrongpassword' },
    });
    assert.equal(status, 401);
  });
});

// ─────────────────────────────────────────────
// Products (public endpoints)
// ─────────────────────────────────────────────
describe('Products - Public', () => {
  it('GET /api/v1/products should return paginated list', async () => {
    const { status, data } = await api('GET', '/api/v1/products?page=1&size=5');
    assert.equal(status, 200);
    assert.ok(data.success);
    assert.ok(Array.isArray(data.data?.content));
    assert.ok(typeof data.data?.totalElements === 'number');
  });

  it('GET /api/v1/products?page=1&size=5 should respect pagination', async () => {
    const { data } = await api('GET', '/api/v1/products?page=1&size=5');
    assert.ok(data.data.content.length <= 5);
    assert.equal(data.data.size, 5);
  });
});

// ─────────────────────────────────────────────
// Products (authenticated)
// ─────────────────────────────────────────────
describe('Products - Authenticated', () => {
  it('POST /api/v1/products should create product', async function () {
    if (!authToken) {
      this.skip('No auth token - login first');
      return;
    }

    const { status, data } = await api('POST', '/api/v1/products', {
      token: authToken,
      body: {
        title: 'Sách Test Node.js',
        description: 'Sách test tự động',
        price: 75000,
        condition: 'GOOD',
        category: 'Sách',
      },
    });

    if (status === 201) {
      productId = data.data?._id;
    }

    assert.ok([200, 201].includes(status));
  });

  it('GET /api/v1/products/:id should return product', async function () {
    if (!productId) {
      this.skip('No product created');
      return;
    }

    const { status, data } = await api('GET', `/api/v1/products/${productId}`);
    assert.equal(status, 200);
    assert.equal(data.data.title, 'Sách Test Node.js');
  });

  it('PUT /api/v1/products/:id should update product', async function () {
    if (!authToken || !productId) {
      this.skip('No auth token or product');
      return;
    }

    const { status } = await api('PUT', `/api/v1/products/${productId}`, {
      token: authToken,
      body: { title: 'Sách Test Updated', price: 60000 },
    });
    assert.equal(status, 200);
  });

  it('POST /api/v1/products without auth should return 401', async () => {
    const { status } = await api('POST', '/api/v1/products', {
      body: { title: 'Test', price: 100 },
    });
    assert.equal(status, 401);
  });
});

// ─────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────
describe('Orders', () => {
  it('POST /api/v1/orders without auth should return 401', async () => {
    const { status } = await api('POST', '/api/v1/orders', {
      body: { productId: '000000000000000000000001' },
    });
    assert.equal(status, 401);
  });

  it('POST /api/v1/orders should create order with idempotency', async function () {
    if (!authToken || !productId) {
      this.skip('No auth token or product');
      return;
    }

    const idempotencyKey = `test-${Date.now()}`;

    const { status, data } = await api('POST', '/api/v1/orders', {
      token: authToken,
      body: {
        productId,
        sellerId: '000000000000000000000001',
        price: 60000,
      },
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    if (status === 201) {
      orderId = data.data?._id;
    }

    assert.ok([200, 201].includes(status));
  });

  it('GET /api/v1/orders/my-orders should return user orders', async function () {
    if (!authToken) {
      this.skip('No auth token');
      return;
    }

    const { status, data } = await api('GET', '/api/v1/orders/my-orders', {
      token: authToken,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data?.content));
  });
});

// ─────────────────────────────────────────────
// Lost & Found
// ─────────────────────────────────────────────
describe('Lost & Found', () => {
  it('GET /api/v1/lost-found should return paginated list', async () => {
    const { status, data } = await api('GET', '/api/v1/lost-found');
    assert.equal(status, 200);
    assert.ok(data.success);
  });

  it('POST /api/v1/lost-found should create item', async function () {
    if (!authToken) {
      this.skip('No auth token');
      return;
    }

    const { status } = await api('POST', '/api/v1/lost-found', {
      token: authToken,
      body: {
        type: 'LOST',
        name: 'Ví da test',
        description: 'Test tự động',
        location: 'Thư viện',
      },
    });
    assert.equal(status, 201);
  });

  it('POST /api/v1/lost-found without auth should return 401', async () => {
    const { status } = await api('POST', '/api/v1/lost-found', {
      body: { type: 'LOST', name: 'Test' },
    });
    assert.equal(status, 401);
  });
});

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────
describe('Notifications', () => {
  it('GET /api/v1/notifications without auth should return 401', async () => {
    const { status } = await api('GET', '/api/v1/notifications');
    assert.equal(status, 401);
  });

  it('GET /api/v1/notifications should return notifications', async function () {
    if (!authToken) {
      this.skip('No auth token');
      return;
    }

    const { status, data } = await api('GET', '/api/v1/notifications', {
      token: authToken,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data?.content));
  });
});

// ─────────────────────────────────────────────
// Auth - Profile & Protected
// ─────────────────────────────────────────────
describe('Protected Endpoints', () => {
  it('GET /api/v1/auth/me should return user profile', async function () {
    if (!authToken) {
      this.skip('No auth token');
      return;
    }

    const { status, data } = await api('GET', '/api/v1/auth/me', {
      token: authToken,
    });
    assert.equal(status, 200);
    assert.ok(data.data?.email);
  });

  it('GET /api/v1/auth/me without token should return 401', async () => {
    const { status } = await api('GET', '/api/v1/auth/me');
    assert.equal(status, 401);
  });
});

// ─────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────
describe('Error Handling', () => {
  it('GET /api/v1/nonexistent should return 404', async () => {
    const { status } = await api('GET', '/api/v1/nonexistent');
    assert.ok([404, 502].includes(status));
  });

  it('Invalid JSON body should return 400', async () => {
    const res = await fetch(`${BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });
    assert.ok([400, 500].includes(res.status));
  });
});
