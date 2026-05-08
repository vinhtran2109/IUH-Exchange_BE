// MongoDB initialization script
// Tạo database và user cho từng microservice

db = db.getSiblingDB('iuh_users');
db.createUser({
  user: 'user_svc',
  pwd: 'user_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_users' }],
});

db = db.getSiblingDB('iuh_products');
db.createUser({
  user: 'product_svc',
  pwd: 'product_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_products' }],
});

db = db.getSiblingDB('iuh_orders');
db.createUser({
  user: 'order_svc',
  pwd: 'order_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_orders' }],
});

db = db.getSiblingDB('iuh_notifications');
db.createUser({
  user: 'notification_svc',
  pwd: 'notification_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_notifications' }],
});

db = db.getSiblingDB('iuh_chat');
db.createUser({
  user: 'chat_svc',
  pwd: 'chat_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_chat' }],
});

db = db.getSiblingDB('iuh_lostfound');
db.createUser({
  user: 'lostfound_svc',
  pwd: 'lostfound_svc_pass',
  roles: [{ role: 'readWrite', db: 'iuh_lostfound' }],
});
