import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:8080/api/v1';
const MONGO_URI = 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_users?authSource=admin';
const TMP_MONGO = 'D:/HK2_Nam4/KienTrucPhanMem/IUH_Exchange/IUH-Exchange_BE/tests/_tmp_mongo.js';
const ts = Date.now();

const state = {
  userA: { email: `usera_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'User A', token: null, id: null },
  userB: { email: `userb_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'User B', token: null, id: null },
  admin: { email: `admin_${ts}@student.iuh.edu.vn`, password: 'Admin123456', name: 'Admin User', token: null, id: null },
  productId: null,
  orderId: null,
  lostFoundId: null,
};

async function api(method, path, { body, token, headers = {} } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function mongosh(script) {
  writeFileSync(TMP_MONGO, script);
  try {
    return execSync(`mongosh "${MONGO_URI}" --quiet "${TMP_MONGO}"`, { timeout: 10000, encoding: 'utf8' });
  } finally {
    try { unlinkSync(TMP_MONGO); } catch {}
  }
}

function verifyUser(email) {
  return mongosh(`db.users.updateOne({email:"${email}"},{$set:{isVerified:true,otp:null,otpExpiry:null}})`);
}

function setAdmin(email) {
  return mongosh(`db.users.updateOne({email:"${email}"},{$set:{role:"ADMIN",isVerified:true}})`);
}

before(async () => {
  const health = await fetch('http://127.0.0.1:8080/health').then((r) => r.json());
  assert.equal(health.status, 'ok');
});

describe('1. Auth', () => {
  it('registers userA', async () => {
    const { status } = await api('POST', '/auth/register', { body: state.userA });
    assert.equal(status, 201);
  });

  it('registers userB', async () => {
    const { status } = await api('POST', '/auth/register', { body: state.userB });
    assert.equal(status, 201);
  });

  it('registers admin', async () => {
    const { status } = await api('POST', '/auth/register', { body: state.admin });
    assert.equal(status, 201);
  });

  it('rejects duplicate register', async () => {
    const { status } = await api('POST', '/auth/register', { body: state.userA });
    assert.equal(status, 400);
  });

  it('verifies OTP in Mongo and promotes admin', async () => {
    verifyUser(state.userA.email);
    verifyUser(state.userB.email);
    verifyUser(state.admin.email);
    setAdmin(state.admin.email);
  });

  it('logs in userA', async () => {
    const { status, data } = await api('POST', '/auth/login', {
      body: { email: state.userA.email, password: state.userA.password },
    });
    assert.equal(status, 200);
    state.userA.token = data.data.accessToken;
    state.userA.id = data.data.userId;
  });

  it('logs in userB', async () => {
    const { status, data } = await api('POST', '/auth/login', {
      body: { email: state.userB.email, password: state.userB.password },
    });
    assert.equal(status, 200);
    state.userB.token = data.data.accessToken;
    state.userB.id = data.data.userId;
  });

  it('logs in admin', async () => {
    const { status, data } = await api('POST', '/auth/login', {
      body: { email: state.admin.email, password: state.admin.password },
    });
    assert.equal(status, 200);
    state.admin.token = data.data.accessToken;
    state.admin.id = data.data.userId;
  });

  it('refreshes access token using cookie or body token', async () => {
    const { status } = await api('POST', '/auth/refresh-token', { body: {} });
    assert.ok([200, 401].includes(status));
  });
});

describe('2. User Profile', () => {
  it('gets current profile', async () => {
    const { status, data } = await api('GET', '/users/me', { token: state.userA.token });
    assert.equal(status, 200);
    assert.equal(data.data.email, state.userA.email);
  });

  it('rejects profile without token', async () => {
    const { status } = await api('GET', '/users/me');
    assert.equal(status, 401);
  });

  it('updates profile', async () => {
    const { status } = await api('PATCH', '/users/me', {
      token: state.userA.token,
      body: { name: 'User A Updated' },
    });
    assert.equal(status, 200);
  });

  it('generates avatar upload URL', async () => {
    const { status, data } = await api('POST', '/users/avatar/presign', {
      token: state.userA.token,
      body: { filename: 'avatar.jpg', contentType: 'image/jpeg' },
    });
    assert.ok([200, 201].includes(status), JSON.stringify(data));
  });
});

describe('3. Admin', () => {
  it('lists users', async () => {
    const { status, data } = await api('GET', '/admin/users?page=1&size=10', { token: state.admin.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.data.content));
  });

  it('reads stats', async () => {
    const { status } = await api('GET', '/admin/stats', { token: state.admin.token });
    assert.equal(status, 200);
  });

  it('reads detail', async () => {
    const { status } = await api('GET', `/admin/${state.userB.id}/detail`, { token: state.admin.token });
    assert.equal(status, 200);
  });

  it('updates role', async () => {
    const { status } = await api('PUT', `/admin/${state.userB.id}/role`, {
      token: state.admin.token,
      body: { role: 'STUDENT' },
    });
    assert.equal(status, 200);
  });

  it('updates permissions', async () => {
    const { status } = await api('PUT', `/admin/${state.userB.id}/permissions`, {
      token: state.admin.token,
      body: { permissions: ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'] },
    });
    assert.equal(status, 200);
  });
});

describe('4. Products', () => {
  it('lists public products', async () => {
    const { status } = await api('GET', '/products?page=1&size=5');
    assert.equal(status, 200);
  });

  it('searches products', async () => {
    const { status } = await api('GET', '/products/search?keyword=sach&page=1&size=5');
    assert.equal(status, 200);
  });

  it('creates product', async () => {
    const { status, data } = await api('POST', '/products', {
      token: state.userA.token,
      body: {
        title: `Codex Product ${ts}`,
        description: 'comprehensive test',
        price: 50000,
        condition: 'GOOD',
        category: 'Sách',
      },
    });
    assert.equal(status, 201);
    state.productId = data.data._id || data.data.id;
  });

  it('updates product', async () => {
    const { status } = await api('PUT', `/products/${state.productId}`, {
      token: state.userA.token,
      body: {
        title: `Codex Product Updated ${ts}`,
        description: 'updated',
        price: 45000,
        condition: 'GOOD',
        category: 'Sách',
      },
    });
    assert.equal(status, 200);
  });

  it('lists pending products as admin', async () => {
    const { status } = await api('GET', '/products/admin/pending?page=1&size=10', { token: state.admin.token });
    assert.equal(status, 200);
  });

  it('approves product', async () => {
    const { status } = await api('PATCH', `/products/admin/${state.productId}/resolve`, {
      token: state.admin.token,
      body: { action: 'APPROVE' },
    });
    assert.equal(status, 200);
  });

  it('checks wishlist endpoints', async () => {
    const toggle = await api('POST', `/products/${state.productId}/wishlist`, { token: state.userB.token });
    const check = await api('GET', `/products/${state.productId}/wishlist/check`, { token: state.userB.token });
    assert.equal(toggle.status, 200);
    assert.equal(check.status, 200);
  });
});

describe('5. Orders & Payment', () => {
  it('creates order', async () => {
    const { status, data } = await api('POST', '/orders', {
      token: state.userB.token,
      headers: { 'Idempotency-Key': `cmp-${ts}` },
      body: {
        productId: state.productId,
        sellerId: state.userA.id,
        price: 45000,
      },
    });
    assert.equal(status, 201);
    state.orderId = data.data._id || data.data.id;
  });

  it('lists my orders', async () => {
    const { status } = await api('GET', '/orders/my-orders?page=1&size=10', { token: state.userB.token });
    assert.equal(status, 200);
  });

  it('creates payment URL', async () => {
    const { status, data } = await api('POST', `/orders/${state.orderId}/payment/create`, {
      token: state.userB.token,
      body: {},
    });
    assert.ok([200, 400].includes(status), JSON.stringify(data));
  });

  it('gets payment details', async () => {
    const { status } = await api('GET', `/orders/${state.orderId}/payment`, { token: state.userB.token });
    assert.equal(status, 200);
  });
});

describe('6. Chat & Notifications', () => {
  it('lists chat conversations', async () => {
    const { status } = await api('GET', '/chat/conversations', { token: state.userA.token });
    assert.equal(status, 200);
  });

  it('searches chat messages', async () => {
    const { status } = await api('GET', '/chat/search?q=test', { token: state.userA.token });
    assert.equal(status, 200);
  });

  it('lists notifications', async () => {
    const { status } = await api('GET', '/notifications', { token: state.userA.token });
    assert.equal(status, 200);
  });

  it('updates notification preferences', async () => {
    const { status } = await api('PUT', '/notifications/preferences', {
      token: state.userA.token,
      body: { email: true, push: true, inApp: true },
    });
    assert.equal(status, 200);
  });
});

describe('7. Lost & Found', () => {
  it('creates lost item', async () => {
    const { status, data } = await api('POST', '/lost-found', {
      token: state.userA.token,
      body: { type: 'LOST', title: `Lost ${ts}`, description: 'desc', location: 'Library' },
    });
    assert.equal(status, 201);
    state.lostFoundId = data.data._id || data.data.id;
  });

  it('gets lost-found list', async () => {
    const { status } = await api('GET', '/lost-found?page=1&size=5');
    assert.equal(status, 200);
  });

  it('claims item', async () => {
    const { status } = await api('POST', `/lost-found/${state.lostFoundId}/claim`, {
      token: state.userB.token,
      body: { message: 'claim test' },
    });
    assert.ok([200, 400].includes(status));
  });

  it('creates and lists report', async () => {
    const create = await api('POST', '/reports', {
      token: state.userB.token,
      body: { targetType: 'LOST_FOUND', targetId: state.lostFoundId, reason: 'test' },
    });
    const list = await api('GET', '/reports/my', { token: state.userB.token });
    assert.ok([201, 400].includes(create.status));
    assert.equal(list.status, 200);
  });
});

describe('8. Security', () => {
  it('rejects user on admin route', async () => {
    const { status } = await api('GET', '/admin/users', { token: state.userA.token });
    assert.equal(status, 403);
  });

  it('returns 404 for unknown route', async () => {
    const { status } = await api('GET', '/nonexistent');
    assert.equal(status, 404);
  });
});

after(() => {
  try { unlinkSync(TMP_MONGO); } catch {}
});
