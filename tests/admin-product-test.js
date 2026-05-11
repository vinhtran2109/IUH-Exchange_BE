
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:8080/api/v1';
const MONGO_URI_USERS = 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_users?authSource=admin';
const TMP_MONGO = 'D:/HK2_Nam4/KienTrucPhanMem/IUH_Exchange/IUH-Exchange_BE/tests/_tmp_mongo_admin.js';

const ts = Date.now();
const state = {
  seller: { email: `seller_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'Seller', token: null, id: null },
  admin: { email: `admin_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'Admin User', token: null, id: null },
};

async function api(method, path, { body, token, query } = {}) {
  let url = `${BASE}${path}`;
  if (query) url += '?' + new URLSearchParams(query).toString();
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function mongosh(uri, script) {
  writeFileSync(TMP_MONGO, script);
  try {
    return execSync(`mongosh "${uri}" --quiet "${TMP_MONGO}"`, { timeout: 10000, encoding: 'utf-8' });
  } catch (e) { return e.stdout || e.stderr || ''; } finally { try { unlinkSync(TMP_MONGO); } catch {} }
}

async function setup() {
  console.log('--- Setting up Seller and Admin ---');
  await api('POST', '/auth/register', { body: { email: state.seller.email, password: state.seller.password, name: state.seller.name } });
  await api('POST', '/auth/register', { body: { email: state.admin.email, password: state.admin.password, name: state.admin.name } });
  
  mongosh(MONGO_URI_USERS, `
    db.users.updateOne({email: "${state.seller.email}"}, {$set: {isVerified: true, otp: null}});
    db.users.updateOne({email: "${state.admin.email}"}, {$set: {isVerified: true, otp: null, role: "ADMIN"}});
  `);
  
  const loginS = await api('POST', '/auth/login', { body: { email: state.seller.email, password: state.seller.password } });
  state.seller.token = loginS.data.data.accessToken;
  state.seller.id = loginS.data.data.userId;
  
  const loginA = await api('POST', '/auth/login', { body: { email: state.admin.email, password: state.admin.password } });
  state.admin.token = loginA.data.data.accessToken;
  state.admin.id = loginA.data.data.userId;
  console.log('Setup complete.');
}

async function testApproval() {
  console.log('\n--- Testing Product Approval ---');
  
  // 1. Create product
  console.log('Seller creates product...');
  const createRes = await api('POST', '/products', {
    token: state.seller.token,
    body: { title: 'Product Approval Test', description: 'Testing approval flow', price: 50000, category: 'ELECTRONICS', condition: 'NEW' }
  });
  
  if (createRes.status !== 201) {
    console.error(`Product creation failed: ${createRes.status} ${JSON.stringify(createRes.data)}`);
    throw new Error('Product creation failed');
  }
  
  const product = createRes.data.data;
  console.log(`Product created with ID: ${product.id}, Status: ${product.status}`);
  assert.equal(product.status, 'PENDING_APPROVAL');
  
  // 2. Admin checks pending list
  console.log('Admin checks pending list...');
  const pendingRes = await api('GET', '/products/admin/pending', { token: state.admin.token });
  const pendingItems = pendingRes.data.data.content;
  const found = pendingItems.find(p => p.id === product.id);
  assert.ok(found, 'Product not found in pending list');
  console.log('Product found in pending list.');
  
  // 3. Admin approves
  console.log('Admin approving product...');
  const approveRes = await api('PATCH', `/products/admin/${product.id}/resolve`, {
    token: state.admin.token,
    query: { action: 'APPROVE' }
  });
  console.log(`Approve status: ${approveRes.status}, New Status: ${approveRes.data.data.status}`);
  assert.equal(approveRes.data.data.status, 'AVAILABLE');
  
  // 4. Verify in public list
  console.log('Checking public list...');
  const publicRes = await api('GET', '/products', { query: { page: 1, size: 50 } });
  const publicItems = publicRes.data.data.content;
  const inPublic = publicItems.find(p => p.id === product.id);
  assert.ok(inPublic, 'Product should be in public list after approval');
  console.log('Product verified in public list.');
}

async function main() {
  try {
    await setup();
    await testApproval();
    console.log('\n✅ ADMIN PRODUCT APPROVAL TESTS PASSED');
  } catch (err) {
    console.error('\n❌ ADMIN PRODUCT APPROVAL TESTS FAILED');
    console.error(err);
    process.exit(1);
  }
}

main();
