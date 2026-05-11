
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:8080/api/v1';
const WS_BASE = 'ws://localhost:8080/ws';
const MONGO_URI_USERS = 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_users?authSource=admin';
const MONGO_URI_PRODUCTS = 'mongodb://root:iuh_exchange_root@127.0.0.1:27018/iuh_products?authSource=admin';
const TMP_MONGO = 'D:/HK2_Nam4/KienTrucPhanMem/IUH_Exchange/IUH-Exchange_BE/tests/_tmp_mongo_adv.js';

const ts = Date.now();
const state = {
  userA: { email: `adv_usera_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'Adv User A', token: null, id: null },
  userB: { email: `adv_userb_${ts}@student.iuh.edu.vn`, password: 'Test123456', name: 'Adv User B', token: null, id: null },
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

function mongosh(uri, script) {
  writeFileSync(TMP_MONGO, script);
  try {
    return execSync(`mongosh "${uri}" --quiet "${TMP_MONGO}"`, { timeout: 10000, encoding: 'utf-8' });
  } catch (e) { return e.stdout || e.stderr || ''; } finally { try { unlinkSync(TMP_MONGO); } catch {} }
}

async function setupUsers() {
  console.log('--- Setting up users ---');
  await api('POST', '/auth/register', { body: { email: state.userA.email, password: state.userA.password, name: state.userA.name } });
  await api('POST', '/auth/register', { body: { email: state.userB.email, password: state.userB.password, name: state.userB.name } });
  mongosh(MONGO_URI_USERS, `db.users.updateMany({email: {$in: ["${state.userA.email}", "${state.userB.email}"]}}, {$set: {isVerified: true, otp: null}})`);
  const loginA = await api('POST', '/auth/login', { body: { email: state.userA.email, password: state.userA.password } });
  state.userA.token = loginA.data.data.accessToken;
  state.userA.id = loginA.data.data.userId;
  const loginB = await api('POST', '/auth/login', { body: { email: state.userB.email, password: state.userB.password } });
  state.userB.token = loginB.data.data.accessToken;
  state.userB.id = loginB.data.data.userId;
  console.log(`Users ready. UserA ID: ${state.userA.id}`);
}

// ── WebSocket Test with SockJS ──
function serializeFrame(command, headers, body = '') {
  let frame = `${command}\n`;
  for (const [key, value] of Object.entries(headers)) {
    frame += `${key}:${value}\n`;
  }
  frame += `\n${body}\x00`;
  return JSON.stringify([frame]);
}

function parseFrames(data) {
  const str = data.toString();
  if (str === 'o') return [{ command: 'OPEN' }];
  if (str === 'h') return [{ command: 'HEARTBEAT' }];
  if (str.startsWith('a')) {
    try {
      const payloads = JSON.parse(str.slice(1));
      return payloads.map(p => {
        const lines = p.split('\n');
        const command = lines[0];
        const headers = {};
        let i = 1;
        while (lines[i] && lines[i] !== '') {
          const parts = lines[i].split(':');
          headers[parts[0]] = parts.slice(1).join(':');
          i++;
        }
        const bodyStart = p.indexOf('\n\n') + 2;
        const bodyEnd = p.lastIndexOf('\x00');
        const body = bodyStart > 1 && bodyEnd > bodyStart ? p.slice(bodyStart, bodyEnd) : '';
        return { command, headers, body };
      });
    } catch (e) { return []; }
  }
  return [];
}

async function testWebSocket() {
  console.log('\n--- Testing WebSocket (SockJS + STOMP) ---');
  const url = `${WS_BASE}/000/adv_test/websocket?token=${state.userA.token}`;
  const ws = new WebSocket(url);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws.close(); reject(new Error('WS Timeout')); }, 15000);
    
    ws.onmessage = (event) => {
      const frames = parseFrames(event.data);
      for (const frame of frames) {
        console.log(`WS Received: ${frame.command}`);
        
        if (frame.command === 'OPEN') {
          ws.send(serializeFrame('CONNECT', { 'accept-version': '1.1', 'Authorization': `Bearer ${state.userA.token}` }));
        }
        
        if (frame.command === 'CONNECTED') {
          ws.send(serializeFrame('SUBSCRIBE', { 'id': 'sub-0', 'destination': '/user/queue/messages' }));
          setTimeout(() => {
            console.log(`Sending message to: ${state.userA.id}`);
            ws.send(serializeFrame('SEND', { 'destination': '/app/chat' }, JSON.stringify({
              recipientId: state.userA.id,
              content: 'Hello from Advanced Test!'
            })));
          }, 1000);
        }
        
        if (frame.command === 'MESSAGE') {
          try {
            const body = JSON.parse(frame.body);
            console.log(`WS Message: ${body.content}`);
            if (body.content === 'Hello from Advanced Test!') {
              console.log('WS Flow Passed.');
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (e) {}
        }
        
        if (frame.command === 'ERROR') {
          console.error('WS Error:', frame.headers.message, frame.body);
          ws.close();
          reject(new Error(frame.headers.message));
        }
      }
    };
    
    ws.onerror = (err) => reject(err);
  });
}

async function testConcurrency() {
  console.log('\n--- Testing Concurrency ---');
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => 
    api('GET', `/products?page=1&size=1&_t=${i}`, { token: state.userA.token })
  ));
  console.log(`30 requests: ${results.filter(r => r.status === 200).length} success`);
}

async function testIdempotency() {
  console.log('\n--- Testing Idempotency ---');
  const key = `idem-${Date.now()}`;
  const prodRes = await api('POST', '/products', {
    token: state.userA.token,
    body: { title: 'Idem Prod', description: 'desc', price: 1000, condition: 'NEW', category: 'TEST' }
  });
  const prodId = prodRes.data.data._id;
  mongosh(MONGO_URI_PRODUCTS, `db.products.updateOne({_id: ObjectId("${prodId}")}, {$set: {status: "APPROVED"}})`);
  
  const res1 = await api('POST', '/orders', {
    token: state.userB.token, headers: { 'Idempotency-Key': key },
    body: { productId: prodId, sellerId: state.userA.id, price: 1000 }
  });
  const res2 = await api('POST', '/orders', {
    token: state.userB.token, headers: { 'Idempotency-Key': key },
    body: { productId: prodId, sellerId: state.userA.id, price: 1000 }
  });
  console.log(`Res1: ${res1.status}, Res2: ${res2.status}`);
}

async function main() {
  try {
    await setupUsers();
    await testWebSocket();
    await testConcurrency();
    await testIdempotency();
    console.log('\n✅ ALL ADVANCED TESTS COMPLETED');
  } catch (err) {
    console.error('\n❌ ADVANCED TESTS FAILED');
    console.error(err);
    process.exit(1);
  }
}
main();
