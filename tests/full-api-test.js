import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://127.0.0.1:8080/api/v1';
const MONGO_URI = 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_users?authSource=admin';
const TMP_MONGO = 'tests/_tmp_mongo_full.js';

const ts = Date.now();
const state = {
  userA: { email: `usera_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'User A', token: null, id: null },
  userB: { email: `userb_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'User B', token: null, id: null },
  admin: { email: `admin_${ts}@student.iuh.edu.vn`, password: 'Admin123456', name: 'Admin User', token: null, id: null },
  productId: null,
  orderId: null,
};

// ── Helpers ──
async function api(method, path, { body, token, headers = {} } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (err) {
    console.error(`Fetch error on ${method} ${path}:`, err.message);
    return { status: 500, error: err.message };
  }
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

// ════════════════════════════════════════════════
// START TESTS
// ════════════════════════════════════════════════

describe('🚀 FULL API INTEGRATION TEST', () => {

  // 1. Setup & Auth
  describe('1. Auth & Identity', () => {
    it('Register User A', async () => {
      const res = await api('POST', '/auth/register', { body: { email: state.userA.email, password: state.userA.password, name: state.userA.name } });
      assert.equal(res.status, 201);
    });

    it('Register Admin', async () => {
      const res = await api('POST', '/auth/register', { body: { email: state.admin.email, password: state.admin.password, name: state.admin.name } });
      assert.equal(res.status, 201);
    });

    it('Bypass OTP & Promote Admin', () => {
      verifyUser(state.userA.email);
      verifyUser(state.admin.email);
      setAdmin(state.admin.email);
    });

    it('Login User A', async () => {
      const res = await api('POST', '/auth/login', { body: { email: state.userA.email, password: state.userA.password } });
      assert.equal(res.status, 200);
      state.userA.token = res.data.data.accessToken;
      state.userA.id = res.data.data.userId;
    });

    it('Login Admin', async () => {
      const res = await api('POST', '/auth/login', { body: { email: state.admin.email, password: state.admin.password } });
      assert.equal(res.status, 200);
      state.admin.token = res.data.data.accessToken;
    });

    it('GET /users/me', async () => {
      const res = await api('GET', '/users/me', { token: state.userA.token });
      assert.equal(res.status, 200);
      assert.equal(res.data.data.email, state.userA.email);
    });
  });

  // 2. Products
  describe('2. Products Workflow', () => {
    it('Create Product (Pending Approval)', async () => {
      const res = await api('POST', '/products', {
        token: state.userA.token,
        body: { title: 'Sách Giải Tích 1', description: 'Sách cũ còn mới', price: 50000, category: 'Sách', condition: 'GOOD' }
      });
      assert.equal(res.status, 201);
      state.productId = res.data.data.id || res.data.data._id;
    });

    it('Admin sees product in pending list', async () => {
      const res = await api('GET', '/products/admin/pending', { token: state.admin.token });
      assert.equal(res.status, 200);
      const found = res.data.data.content.find(p => p.id === state.productId);
      assert.ok(found, 'Admin should see pending product');
    });

    it('Admin approves product', async () => {
      const res = await api('PATCH', `/products/admin/${state.productId}/resolve`, {
        token: state.admin.token,
        body: { action: 'APPROVE' }
      });
      assert.equal(res.status, 200);
    });

    it('Product should now be visible in public list', async () => {
      const res = await api('GET', '/products?size=100');
      const found = res.data.data.content.find(p => p.id === state.productId);
      assert.ok(found, 'Product should be available');
    });
  });

  // 3. User Admin
  describe('3. User Administration', () => {
    it('Admin list users', async () => {
      const res = await api('GET', '/admin/users?page=1&size=10', { token: state.admin.token });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.data.content));
    });

    it('Admin check user stats', async () => {
      const res = await api('GET', '/users/admin/stats', { token: state.admin.token });
      assert.equal(res.status, 200);
      assert.ok(res.data.data.total !== undefined);
    });
  });

  // 5. Lost & Found
  describe('5. Lost & Found', () => {
    it('Create Lost Item', async () => {
      const res = await api('POST', '/lost-found', {
        token: state.userA.token,
        body: { type: 'LOST', title: 'Mất thẻ sinh viên', description: 'Rơi ở nhà H', location: 'Nhà H' }
      });
      assert.equal(res.status, 201);
    });

    it('List Lost & Found', async () => {
      const res = await api('GET', '/lost-found');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.data.content));
    });
  });

  // 6. Security & Edge Cases
  describe('6. Security & Edge Cases', () => {
    it('Access Admin route with Student token → 403', async () => {
      const res = await api('GET', '/products/admin/pending', { token: state.userA.token });
      assert.equal(res.status, 403);
    });

    it('Access Protected route without token → 401', async () => {
      const res = await api('GET', '/users/me');
      assert.equal(res.status, 401);
    });

    it('Invalid Product ID → 404', async () => {
      const res = await api('GET', '/products/000000000000000000000000');
      assert.equal(res.status, 404);
    });

    it('Profanity Filter Check', async () => {
      const res = await api('POST', '/products', {
        token: state.userA.token,
        body: { 
          title: 'Cái đm test', 
          description: 'Mô tả hợp lệ',
          price: 100, 
          category: 'Sách', 
          condition: 'GOOD' 
        }
      });
      assert.equal(res.status, 400);
      assert.ok(res.data.message.includes('phù hợp'));
    });
  });

});

after(() => {
  try { unlinkSync(TMP_MONGO); } catch {}
});
