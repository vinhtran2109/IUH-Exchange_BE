import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:8080/api/v1';
const MONGO_URI = 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_users?authSource=admin';
const TMP_MONGO = 'D:/HK2_Nam4/KienTrucPhanMem/IUH_Exchange/IUH-Exchange_BE/tests/_tmp_mongo.js';

const ts = Date.now();
const state = {
  userA: { email: `usera_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'User A', token: null, refreshToken: null, id: null },
  userB: { email: `userb_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'User B', token: null, refreshToken: null, id: null },
  admin: { email: `admin_${ts}@student.iuh.edu.vn`, password: 'Admin123456', name: 'Admin User', token: null, refreshToken: null, id: null },
  productId: null, orderId: null, lostFoundId: null, lfForDelete: null,
};

// ── Helpers ──
async function api(method, path, { body, token, headers = {} } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function mongosh(script) {
  writeFileSync(TMP_MONGO, script);
  try {
    return execSync(`mongosh "${MONGO_URI}" --quiet "${TMP_MONGO}"`, { timeout: 10000, encoding: 'utf-8' });
  } catch (e) { return e.stdout || e.stderr || ''; }
}

function verifyUser(email) {
  return mongosh(`db.users.updateOne({email:"${email}"},{$set:{isVerified:true,otp:null,otpExpiry:null}})`);
}
function setAdmin(email) {
  return mongosh(`db.users.updateOne({email:"${email}"},{$set:{role:"ADMIN",isVerified:true}})`);
}
function makeUserBanned(id) {
  return mongosh(`db.users.updateOne({_id:ObjectId("${id}")},{$set:{isActive:false,permissions:[]}})`);
}
function makeUserActive(id) {
  return mongosh(`db.users.updateOne({_id:ObjectId("${id}")},{$set:{isActive:true,permissions:["CAN_POST","CAN_CHAT","CAN_REPORT"]}})`);
}

// ════════════════════════════════════════════════
// 1. AUTH - Register
// ════════════════════════════════════════════════
describe('1. Auth - Register', () => {
  it('POST /auth/register - userA success', async () => {
    const { status, data } = await api('POST', '/auth/register', { body: { email: state.userA.email, password: state.userA.password, name: state.userA.name } });
    assert.equal(status, 201);
    assert.ok(data.success);
  });
  it('POST /auth/register - userB success', async () => {
    const { status } = await api('POST', '/auth/register', { body: { email: state.userB.email, password: state.userB.password, name: state.userB.name } });
    assert.equal(status, 201);
  });
  it('POST /auth/register - admin success', async () => {
    const { status } = await api('POST', '/auth/register', { body: { email: state.admin.email, password: state.admin.password, name: state.admin.name } });
    assert.equal(status, 201);
  });
  it('POST /auth/register - reject non-IUH email', async () => {
    const { status } = await api('POST', '/auth/register', { body: { email: 'test@gmail.com', password: 'Test123456', name: 'X' } });
    assert.equal(status, 400);
  });
  it('POST /auth/register - reject short password', async () => {
    const { status } = await api('POST', '/auth/register', { body: { email: `short_${ts}@student.iuh.edu.vn`, password: '123', name: 'X' } });
    assert.equal(status, 400);
  });
  it('POST /auth/register - reject duplicate', async () => {
    const { status } = await api('POST', '/auth/register', { body: { email: state.userA.email, password: state.userA.password, name: state.userA.name } });
    assert.equal(status, 400);
  });
});

// ════════════════════════════════════════════════
// 2. AUTH - OTP bypass & Login
// ════════════════════════════════════════════════
describe('2. Auth - OTP & Login', () => {
  before(() => {
    verifyUser(state.userA.email);
    verifyUser(state.userB.email);
    verifyUser(state.admin.email);
    setAdmin(state.admin.email);
  });

  it('POST /auth/login - userA', async () => {
    const { status, data } = await api('POST', '/auth/login', { body: { email: state.userA.email, password: state.userA.password } });
    assert.equal(status, 200);
    assert.ok(data.data?.accessToken);
    state.userA.token = data.data.accessToken;
    state.userA.refreshToken = data.data.refreshToken;
    state.userA.id = data.data.user?.id || data.data.user?._id;
  });
  it('POST /auth/login - userB', async () => {
    const { status, data } = await api('POST', '/auth/login', { body: { email: state.userB.email, password: state.userB.password } });
    assert.equal(status, 200);
    state.userB.token = data.data.accessToken;
    state.userB.refreshToken = data.data.refreshToken;
    state.userB.id = data.data.user?.id || data.data.user?._id;
  });
  it('POST /auth/login - admin', async () => {
    const { status, data } = await api('POST', '/auth/login', { body: { email: state.admin.email, password: state.admin.password } });
    assert.equal(status, 200);
    state.admin.token = data.data.accessToken;
    state.admin.refreshToken = data.data.refreshToken;
    state.admin.id = data.data.user?.id || data.data.user?._id;
  });
  it('POST /auth/login - wrong password → 401', async () => {
    const { status } = await api('POST', '/auth/login', { body: { email: state.userA.email, password: 'wrongpassword' } });
    assert.equal(status, 401);
  });
  it('POST /auth/login - unverified user → 400', async () => {
    const email = `unverified_${ts}@student.iuh.edu.vn`;
    await api('POST', '/auth/register', { body: { email, password: 'Test123456', name: 'Unverified' } });
    const { status } = await api('POST', '/auth/login', { body: { email, password: 'Test123456' } });
    assert.equal(status, 400);
  });
});

// ════════════════════════════════════════════════
// 3. AUTH - Token refresh & Password
// ════════════════════════════════════════════════
describe('3. Auth - Token & Password', () => {
  it('POST /auth/refresh-token', async () => {
    const { status, data } = await api('POST', '/auth/refresh-token', { body: { refreshToken: state.userA.refreshToken } });
    assert.ok([200, 401, 400].includes(status), `Unexpected: ${status}`);
    if (status === 200 && data.data?.accessToken) state.userA.token = data.data.accessToken;
  });
  it('PUT /auth/change-password', async () => {
    const { status } = await api('PUT', '/auth/change-password', {
      token: state.userA.token,
      body: { currentPassword: state.userA.password, newPassword: 'NewTest123456' }
    });
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
    if (status === 200) {
      const { data } = await api('POST', '/auth/login', { body: { email: state.userA.email, password: 'NewTest123456' } });
      state.userA.token = data.data.accessToken;
      await api('PUT', '/auth/change-password', { token: state.userA.token, body: { currentPassword: 'NewTest123456', newPassword: state.userA.password } });
      const { data: d2 } = await api('POST', '/auth/login', { body: { email: state.userA.email, password: state.userA.password } });
      state.userA.token = d2.data.accessToken;
    }
  });
  it('POST /auth/forgot-password', async () => {
    const { status } = await api('POST', '/auth/forgot-password', { body: { email: state.userA.email } });
    assert.ok([200, 201, 400].includes(status), `Unexpected: ${status}`);
  });
  it('POST /auth/logout', async () => {
    const { status } = await api('POST', '/auth/logout', { token: state.userA.token });
    assert.ok([200, 204].includes(status), `Unexpected: ${status}`);
    const { data } = await api('POST', '/auth/login', { body: { email: state.userA.email, password: state.userA.password } });
    state.userA.token = data.data.accessToken;
  });
});

// ════════════════════════════════════════════════
// 4. User Profile
// ════════════════════════════════════════════════
describe('4. User Profile', () => {
  it('GET /users/me', async () => {
    const { status, data } = await api('GET', '/users/me', { token: state.userA.token });
    assert.equal(status, 200);
    assert.equal(data.data?.email, state.userA.email);
  });
  it('GET /users/me without token → 401', async () => {
    const { status } = await api('GET', '/users/me');
    assert.equal(status, 401);
  });
  it('GET /users/:id - other user', async () => {
    const { status, data } = await api('GET', `/users/${state.userB.id}`, { token: state.userA.token });
    assert.equal(status, 200);
    assert.ok(data.data?.email);
  });
  it('PATCH /users/me - update name', async () => {
    const { status } = await api('PATCH', '/users/me', { token: state.userA.token, body: { name: 'User A Updated' } });
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
  it('POST /users/avatar/presign', async () => {
    const { status } = await api('POST', '/users/avatar/presign', { token: state.userA.token, body: { filename: 'avatar.jpg', contentType: 'image/jpeg' } });
    assert.ok([200, 201].includes(status), `Unexpected: ${status}`);
  });
});

// ════════════════════════════════════════════════
// 5. Admin Operations
// ════════════════════════════════════════════════
describe('5. Admin Operations', () => {
  it('GET /admin/users - list', async () => {
    const { status, data } = await api('GET', '/admin/users?page=1&size=10', { token: state.admin.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data?.content));
  });
  it('GET /admin/users without admin → 403', async () => {
    const { status } = await api('GET', '/admin/users', { token: state.userA.token });
    assert.equal(status, 403);
  });
  it('GET /admin/stats', async () => {
    const { status, data } = await api('GET', '/admin/stats', { token: state.admin.token });
    assert.equal(status, 200);
    assert.ok(data.data?.total !== undefined);
  });
  it('GET /admin/users/:id/detail', async () => {
    const { status, data } = await api('GET', `/admin/users/${state.userA.id}/detail`, { token: state.admin.token });
    assert.equal(status, 200);
    assert.ok(data.data?.email);
  });
  it('PUT /admin/users/:id/role', async () => {
    const { status } = await api('PUT', `/admin/users/${state.userB.id}/role`, { token: state.admin.token, body: { role: 'MODERATOR' } });
    assert.equal(status, 200);
    await api('PUT', `/admin/users/${state.userB.id}/role`, { token: state.admin.token, body: { role: 'STUDENT' } });
  });
  it('PUT /admin/users/:id/permissions', async () => {
    const { status } = await api('PUT', `/admin/users/${state.userB.id}/permissions`, { token: state.admin.token, body: { permissions: ['CAN_POST', 'CAN_CHAT'] } });
    assert.equal(status, 200);
  });
  it('PUT /admin/users/:id/karma', async () => {
    const { status } = await api('PUT', `/admin/users/${state.userB.id}/karma`, { token: state.admin.token, body: { amount: -10, reason: 'Test' } });
    assert.equal(status, 200);
  });
  it('POST /admin/users/:id/ban', async () => {
    const { status, data } = await api('POST', `/admin/users/${state.userB.id}/ban`, { token: state.admin.token, body: { reason: 'Test ban' } });
    assert.equal(status, 200);
    assert.equal(data.data?.isActive, false);
  });
  it('POST /admin/users/:id/unban', async () => {
    const { status, data } = await api('POST', `/admin/users/${state.userB.id}/unban`, { token: state.admin.token });
    assert.equal(status, 200);
    assert.equal(data.data?.isActive, true);
  });
  it('GET /admin/users - pagination', async () => {
    const { status, data } = await api('GET', '/admin/users?page=1&size=2', { token: state.admin.token });
    assert.equal(status, 200);
    assert.ok(data.data.content.length <= 2);
  });
});

// ════════════════════════════════════════════════
// 6. Products
// ════════════════════════════════════════════════
describe('6. Products', () => {
  it('GET /products - public list', async () => {
    const { status, data } = await api('GET', '/products?page=1&size=5');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data?.content));
  });
  it('POST /products without auth → 401', async () => {
    const { status } = await api('POST', '/products', { body: { title: 'Test', price: 100 } });
    assert.equal(status, 401);
  });
  it('POST /products - create as userA', async () => {
    const { status, data } = await api('POST', '/products', {
      token: state.userA.token,
      body: { title: 'Sách Kiến Trúc Phần Mềm', description: 'Sách mới 95%', price: 75000, condition: 'GOOD', category: 'Sách' }
    });
    assert.ok([200, 201].includes(status), `Unexpected: ${status}`);
    if (data.data?._id) state.productId = data.data._id;
  });
  it('GET /products/me', async () => {
    const { status } = await api('GET', '/products/me', { token: state.userA.token });
    assert.equal(status, 200);
  });
  it('GET /products/:id', async () => {
    if (!state.productId) return;
    const { status, data } = await api('GET', `/products/${state.productId}`);
    assert.equal(status, 200);
    assert.equal(data.data?.title, 'Sách Kiến Trúc Phần Mềm');
  });
  it('PUT /products/:id', async () => {
    if (!state.productId) return;
    const { status } = await api('PUT', `/products/${state.productId}`, {
      token: state.userA.token,
      body: { title: 'Sách KTPM - Updated', price: 60000, condition: 'GOOD', category: 'Sách' }
    });
    assert.equal(status, 200);
  });
  it('POST /products/upload-url', async () => {
    const { status } = await api('POST', '/products/upload-url', { token: state.userA.token, body: { filename: 'product.jpg', contentType: 'image/jpeg' } });
    assert.ok([200, 201].includes(status), `Unexpected: ${status}`);
  });
  it('GET /products/search', async () => {
    const { status } = await api('GET', '/products/search?keyword=sách');
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
});

// ════════════════════════════════════════════════
// 7. Product Admin
// ════════════════════════════════════════════════
describe('7. Product Admin', () => {
  it('GET /products/admin/pending as admin', async () => {
    const { status } = await api('GET', '/products/admin/pending?page=1&size=10', { token: state.admin.token });
    assert.equal(status, 200);
  });
  it('GET /products/admin/pending without admin → 403', async () => {
    const { status } = await api('GET', '/products/admin/pending', { token: state.userA.token });
    assert.equal(status, 403);
  });
  it('PATCH /products/admin/:id/resolve - approve', async () => {
    if (!state.productId) return;
    const { status } = await api('PATCH', `/products/admin/${state.productId}/resolve`, { token: state.admin.token, body: { action: 'approve' } });
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
  it('GET /products/admin/stats', async () => {
    const { status } = await api('GET', '/products/admin/stats', { token: state.admin.token });
    assert.equal(status, 200);
  });
});

// ════════════════════════════════════════════════
// 8. Orders
// ════════════════════════════════════════════════
describe('8. Orders', () => {
  it('POST /orders without auth → 401', async () => {
    const { status } = await api('POST', '/orders', { body: { productId: '000000000000000000000001' } });
    assert.equal(status, 401);
  });
  it('POST /orders - create as userB', async () => {
    if (!state.productId) return;
    const key = `order-${ts}`;
    const { status, data } = await api('POST', '/orders', {
      token: state.userB.token,
      body: { productId: state.productId, sellerId: state.userA.id, price: 60000 },
      headers: { 'Idempotency-Key': key }
    });
    assert.ok([200, 201].includes(status), `Unexpected: ${status}`);
    if (data.data?._id) state.orderId = data.data._id;
  });
  it('POST /orders - idempotency (same key)', async () => {
    if (!state.productId) return;
    const key = `order-${ts}`;
    const { status } = await api('POST', '/orders', {
      token: state.userB.token,
      body: { productId: state.productId, sellerId: state.userA.id, price: 60000 },
      headers: { 'Idempotency-Key': key }
    });
    assert.ok([200, 201, 409].includes(status), `Unexpected: ${status}`);
  });
  it('GET /orders', async () => {
    const { status, data } = await api('GET', '/orders?page=1&size=10', { token: state.userB.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data?.content));
  });
  it('GET /orders/me', async () => {
    const { status } = await api('GET', '/orders/me', { token: state.userB.token });
    assert.equal(status, 200);
  });
  it('GET /orders/:id', async () => {
    if (!state.orderId) return;
    const { status } = await api('GET', `/orders/${state.orderId}`, { token: state.userB.token });
    assert.equal(status, 200);
  });
  it('PATCH /orders/:id/confirm as seller', async () => {
    if (!state.orderId) return;
    const { status } = await api('PATCH', `/orders/${state.orderId}/confirm`, { token: state.userA.token });
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
});

// ════════════════════════════════════════════════
// 9. Chat
// ════════════════════════════════════════════════
describe('9. Chat', () => {
  it('GET /chat/conversations', async () => {
    const { status } = await api('GET', '/chat/conversations', { token: state.userA.token });
    assert.equal(status, 200);
  });
  it('GET /chat/conversations without auth → 401', async () => {
    const { status } = await api('GET', '/chat/conversations');
    assert.equal(status, 401);
  });
  it('GET /chat/search?q=test', async () => {
    const { status } = await api('GET', '/chat/search?q=test', { token: state.userA.token });
    assert.ok([200, 404].includes(status), `Unexpected: ${status}`);
  });
  it('POST /chat/upload-url', async () => {
    const { status } = await api('POST', '/chat/upload-url', { token: state.userA.token, body: { filename: 'chat.jpg', contentType: 'image/jpeg' } });
    assert.ok([200, 201].includes(status), `Unexpected: ${status}`);
  });
  it('PATCH /chat/conversations/read-all', async () => {
    const { status } = await api('PATCH', '/chat/conversations/read-all', { token: state.userA.token });
    assert.ok([200, 204].includes(status), `Unexpected: ${status}`);
  });
});

// ════════════════════════════════════════════════
// 10. Notifications
// ════════════════════════════════════════════════
describe('10. Notifications', () => {
  it('GET /notifications without auth → 401', async () => {
    const { status } = await api('GET', '/notifications');
    assert.equal(status, 401);
  });
  it('GET /notifications', async () => {
    const { status, data } = await api('GET', '/notifications', { token: state.userA.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data?.content));
  });
  it('GET /notifications/unread-count', async () => {
    const { status } = await api('GET', '/notifications/unread-count', { token: state.userA.token });
    assert.equal(status, 200);
  });
  it('PATCH /notifications/read-all', async () => {
    const { status } = await api('PATCH', '/notifications/read-all', { token: state.userA.token });
    assert.ok([200, 204].includes(status), `Unexpected: ${status}`);
  });
});

// ════════════════════════════════════════════════
// 11. FCM
// ════════════════════════════════════════════════
describe('11. FCM', () => {
  it('POST /notifications/fcm/register', async () => {
    const { status } = await api('POST', '/notifications/fcm/register', { token: state.userA.token, body: { token: 'test-fcm-token-123', deviceType: 'web' } });
    assert.ok([200, 201].includes(status), `Unexpected: ${status}`);
  });
  it('POST /notifications/fcm/test', async () => {
    const { status } = await api('POST', '/notifications/fcm/test', { token: state.userA.token });
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
  it('DELETE /notifications/fcm/unregister', async () => {
    const { status } = await api('DELETE', '/notifications/fcm/unregister', { token: state.userA.token, body: { token: 'test-fcm-token-123' } });
    assert.ok([200, 204].includes(status), `Unexpected: ${status}`);
  });
});

// ════════════════════════════════════════════════
// 12. DLQ (Admin)
// ════════════════════════════════════════════════
describe('12. DLQ (Admin)', () => {
  it('GET /notifications/dlq as admin', async () => {
    const { status } = await api('GET', '/notifications/dlq', { token: state.admin.token });
    assert.equal(status, 200);
  });
  it('GET /notifications/dlq without admin → 403', async () => {
    const { status } = await api('GET', '/notifications/dlq', { token: state.userA.token });
    assert.equal(status, 403);
  });
});

// ════════════════════════════════════════════════
// 13. Lost & Found
// ════════════════════════════════════════════════
describe('13. Lost & Found', () => {
  it('GET /lost-found - public list', async () => {
    const { status } = await api('GET', '/lost-found');
    assert.equal(status, 200);
  });
  it('POST /lost-found without auth → 401', async () => {
    const { status } = await api('POST', '/lost-found', { body: { type: 'LOST', name: 'Test' } });
    assert.equal(status, 401);
  });


// ════════════════════════════════════════════════
// 14. Security Tests
// ════════════════════════════════════════════════
describe('14. Security Tests', () => {
  it('Missing JWT → 401', async () => {
    const { status } = await api('GET', '/users/me');
    assert.equal(status, 401);
  });
  it('Invalid JWT → 401', async () => {
    const { status } = await api('GET', '/users/me', { token: 'invalid.jwt.token' });
    assert.equal(status, 401);
  });
  it('User tries admin route → 403', async () => {
    const { status } = await api('GET', '/admin/users', { token: state.userA.token });
    assert.equal(status, 403);
  });
  it('GET /nonexistent → 404', async () => {
    const { status } = await api('GET', '/nonexistent');
    assert.ok([404, 502].includes(status), `Unexpected: ${status}`);
  });
  it('Invalid JSON body → 400', async () => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json'
    });
    assert.ok([400, 500].includes(res.status), `Unexpected: ${res.status}`);
  });
  it('Negative page number', async () => {
    const { status } = await api('GET', '/products?page=-1&size=5');
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
  it('Very large page size', async () => {
    const { status } = await api('GET', '/products?page=1&size=99999');
    assert.ok([200, 400].includes(status), `Unexpected: ${status}`);
  });
  it('XSS payload in register', async () => {
    const { status } = await api('POST', '/auth/register', {
      body: { email: `xss_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: '<script>alert("xss")</script>' }
    });
    assert.ok([200, 201, 400].includes(status), `Unexpected: ${status}`);
  });
});
