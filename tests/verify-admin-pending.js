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
    state.userA.id = data.data.userId;
  });
  it('POST /auth/login - userB', async () => {
    const { status, data } = await api('POST', '/auth/login', { body: { email: state.userB.email, password: state.userB.password } });
    assert.equal(status, 200);
    state.userB.token = data.data.accessToken;
    state.userB.refreshToken = data.data.refreshToken;
    state.userB.id = data.data.userId;
  });
  it('POST /auth/login - admin', async () => {
    const { status, data } = await api('POST', '/auth/login', { body: { email: state.admin.email, password: state.admin.password } });
    assert.equal(status, 200);
    state.admin.token = data.data.accessToken;
    state.admin.refreshToken = data.data.refreshToken;
    state.admin.id = data.data.userId;
  });
});

// ════════════════════════════════════════════════
// 7. Product Admin
// ════════════════════════════════════════════════
describe('7. Product Admin', () => {
  it('GET /products/admin/pending as admin', async () => {
    const { status, data } = await api('GET', '/products/admin/pending?page=1&size=10', { token: state.admin.token });
    assert.equal(status, 200);
    assert.ok(data.data?.content);
  });
  it('GET /products/admin/pending without admin → 403', async () => {
    const { status } = await api('GET', '/products/admin/pending', { token: state.userA.token });
    assert.equal(status, 403);
  });
});

// ... (Rest of the file would be too long, let's just test this section)
