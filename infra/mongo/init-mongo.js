// MongoDB Init Script - IUH Campus Exchange Platform
// Khởi tạo các databases và users cho từng service

// Tạo Admin User
db = db.getSiblingDB('admin');
db.auth('root', 'iuh_exchange_root');

// ─────────────── User Service DB ───────────────
db = db.getSiblingDB('iuh_users');
db.createUser({
  user: 'user_svc',
  pwd: 'user_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_users' }]
});
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ karmaPoint: -1 });

// ─────────────── Product Service DB ───────────────
db = db.getSiblingDB('iuh_products');
db.createUser({
  user: 'product_svc',
  pwd: 'product_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_products' }]
});
db.createCollection('products');
db.products.createIndex({ sellerId: 1 });
db.products.createIndex({ status: 1 });
db.products.createIndex({ name: 'text', description: 'text' });

// ─────────────── Order Service DB ───────────────
db = db.getSiblingDB('iuh_orders');
db.createUser({
  user: 'order_svc',
  pwd: 'order_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_orders' }]
});
db.createCollection('orders');
// Composite index chống duplicate order
db.orders.createIndex({ buyerId: 1, productId: 1, status: 1 });
db.orders.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });

// ─────────────── Lost & Found Service DB ───────────────
db = db.getSiblingDB('iuh_lostfound');
db.createUser({
  user: 'lostfound_svc',
  pwd: 'lostfound_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_lostfound' }]
});
db.createCollection('lost_items');

// ─────────────── Notification Service DB ───────────────
db = db.getSiblingDB('iuh_notifications');
db.createUser({
  user: 'notification_svc',
  pwd: 'notification_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_notifications' }]
});
db.createCollection('notifications');
db.notifications.createIndex({ userId: 1, isRead: 1 });

// ─────────────── Chat Service DB ───────────────
db = db.getSiblingDB('iuh_chat');
db.createUser({
  user: 'chat_svc',
  pwd: 'chat_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_chat' }]
});
db.createCollection('messages');
db.messages.createIndex({ conversationId: 1, createdAt: -1 });

print('✅ MongoDB initialization completed for IUH Campus Exchange Platform!');
