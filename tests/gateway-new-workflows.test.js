import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.GATEWAY_BASE_URL || 'http://127.0.0.1:8080/api/v1';
const MONGO_URI = process.env.GATEWAY_TEST_USER_MONGO_URI || 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_users?authSource=admin';
const TMP_MONGO = 'tests/_tmp_mongo_gateway_workflows.js';
const ts = Date.now();

const state = {
  seller: { email: `seller_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'Seller', token: null, id: null },
  buyer: { email: `buyer_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'Buyer', token: null, id: null },
  admin: { email: `adminwf_${ts}@student.iuh.edu.vn`, password: 'Admin123456', name: 'Admin', token: null, id: null },
  productId: null,
  offerId: null,
  orderId: null,
  proposalId: null,
};

async function api(method, path, { body, token, headers = {} } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function apiRetry(method, path, options = {}, attempts = 5) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    last = await api(method, path, options);
    if (![502, 503, 504].includes(last.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return last;
}

function mongosh(script) {
  writeFileSync(TMP_MONGO, script);
  return execSync(`mongosh "${MONGO_URI}" --quiet "${TMP_MONGO}"`, { timeout: 10000, encoding: 'utf-8' });
}

function verifyAndPromote() {
  mongosh(`
    db.users.updateOne({email:"${state.seller.email}"},{$set:{isVerified:true,otp:null,otpExpiry:null}});
    db.users.updateOne({email:"${state.buyer.email}"},{$set:{isVerified:true,otp:null,otpExpiry:null}});
    db.users.updateOne({email:"${state.admin.email}"},{$set:{isVerified:true,role:"ADMIN",adminTwoFactorEnabled:false,otp:null,otpExpiry:null}});
  `);
}

async function waitForOrderStatus(status, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await api('GET', `/orders/${state.orderId}`, { token: state.buyer.token });
    if (res.data?.data?.status === status) return res.data.data;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Order did not reach ${status}`);
}

describe('Gateway workflows: offer, handover, dispute', () => {
  it('registers and logs in seller, buyer, admin', async () => {
    for (const user of [state.seller, state.buyer, state.admin]) {
      const registered = await api('POST', '/auth/register', {
        body: { email: user.email, password: user.password, name: user.name },
      });
      assert.equal(registered.status, 201);
    }

    verifyAndPromote();

    for (const user of [state.seller, state.buyer, state.admin]) {
      const loggedIn = await api('POST', '/auth/login', {
        body: { email: user.email, password: user.password },
        headers: user === state.admin ? { 'x-admin-portal': 'true' } : {},
      });
      assert.equal(loggedIn.status, 200);
      user.token = loggedIn.data.data.accessToken;
      user.id = loggedIn.data.data.userId;
    }
  });

  it('creates and approves a product through the gateway', async () => {
    const created = await api('POST', '/products', {
      token: state.seller.token,
      body: {
        title: 'Gateway workflow textbook',
        description: 'Integration test item for offer handover dispute workflow',
        price: 100000,
        category: 'BOOKS',
        condition: 'GOOD',
        imageUrls: [],
        allowOffers: true,
      },
    });
    assert.equal(created.status, 201);
    state.productId = created.data.data.id;

    const approved = await api('PATCH', `/products/admin/${state.productId}/resolve`, {
      token: state.admin.token,
      body: { action: 'APPROVE' },
    });
    assert.equal(approved.status, 200);
  });

  it('runs offer -> accept -> order via gateway', async () => {
    const offer = await api('POST', `/products/${state.productId}/offers`, {
      token: state.buyer.token,
      body: { type: 'PRICE', amount: 75000, message: 'Can you do 75k?' },
    });
    assert.equal(offer.status, 201);
    state.offerId = offer.data.data.id;

    const accepted = await apiRetry('PATCH', `/products/offers/${state.offerId}/resolve`, {
      token: state.seller.token,
      body: { action: 'ACCEPT' },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.data.status, 'ACCEPTED');

    const ordered = await apiRetry('POST', '/orders', {
      token: state.buyer.token,
      headers: { 'Idempotency-Key': `offer-order-${ts}` },
      body: { offerId: state.offerId, idempotencyKey: `offer-order-${ts}` },
    });
    assert.equal(ordered.status, 201);
    state.orderId = ordered.data.data._id || ordered.data.data.id;
    assert.equal(ordered.data.data.price, 75000);
  });

  it('runs handover proposal -> accept -> confirm via gateway', async () => {
    await waitForOrderStatus('AWAITING_SELLER');
    const proposed = await api('POST', `/orders/${state.orderId}/handover/proposals`, {
      token: state.buyer.token,
      body: {
        location: 'IUH Library',
        time: new Date(Date.now() + 3600000).toISOString(),
        note: 'Meet near the front desk',
      },
    });
    assert.equal(proposed.status, 201);
    const proposals = proposed.data.data.meetingProposals;
    state.proposalId = proposals[proposals.length - 1]._id;

    const accepted = await api('PATCH', `/orders/${state.orderId}/handover/proposals/${state.proposalId}`, {
      token: state.seller.token,
      body: { action: 'ACCEPT' },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.data.handoverStatus, 'SCHEDULED');

    const buyerConfirmed = await api('PATCH', `/orders/${state.orderId}/handover/confirm`, { token: state.buyer.token });
    assert.equal(buyerConfirmed.status, 200);

    const sellerConfirmed = await api('PATCH', `/orders/${state.orderId}/handover/confirm`, { token: state.seller.token });
    assert.equal(sellerConfirmed.status, 200);
    assert.equal(sellerConfirmed.data.data.handoverStatus, 'HANDED_OVER');
  });

  it('runs dispute -> evidence -> resolve via gateway', async () => {
    const completed = await api('PATCH', `/orders/${state.orderId}/confirm`, { token: state.seller.token });
    assert.equal(completed.status, 200);

    const dispute = await api('POST', `/orders/${state.orderId}/disputes`, {
      token: state.buyer.token,
      body: { reason: 'Item condition differs from the approved listing' },
    });
    assert.equal(dispute.status, 201);
    assert.equal(dispute.data.data.disputeStatus, 'OPEN');

    const evidence = await api('POST', `/orders/${state.orderId}/disputes/evidence`, {
      token: state.buyer.token,
      body: { type: 'OTHER', url: 'https://example.com/evidence.jpg', note: 'Photo evidence' },
    });
    assert.equal(evidence.status, 201);
    assert.ok(evidence.data.data.disputeEvidence.length > 0);

    const resolved = await api('PATCH', `/orders/${state.orderId}/disputes/resolve`, {
      token: state.admin.token,
      body: { status: 'RESOLVED', resolution: 'Admin reviewed the evidence' },
    });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.data.data.disputeStatus, 'RESOLVED');
  });
});

after(() => {
  try { unlinkSync(TMP_MONGO); } catch {}
});
