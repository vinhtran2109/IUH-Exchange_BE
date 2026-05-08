import express from 'express';
import { config, logger, connectMongo, errorHandler, getRedis } from '@iuh-exchange/common';
import { Order } from './models/Order.js';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_orders';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

// ── Create Order (with Idempotency-Key) ──
app.post('/api/v1/orders', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ success: false, statusCode: 400, message: 'Missing Idempotency-Key header' });
  }

  // Check idempotency in Redis
  const redis = getRedis();
  const existing = await redis.get(`idempotency:${idempotencyKey}`);
  if (existing) {
    return res.json(JSON.parse(existing));
  }

  // TODO: Publish OrderCreatedEvent to Kafka
  const order = await Order.create({
    ...req.body,
    buyerId: req.user?.sub,
    idempotencyKey,
  });

  const response = {
    success: true,
    statusCode: 201,
    data: order,
    timestamp: new Date().toISOString(),
  };

  // Cache idempotency result for 24h
  await redis.setex(`idempotency:${idempotencyKey}`, 86400, JSON.stringify(response));

  res.status(201).json(response);
});

// GET /api/v1/orders - List user's orders
app.get('/api/v1/orders', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(100, parseInt(req.query.size || '20'));
  const skip = (page - 1) * size;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  // If not admin, only show own orders
  if (req.user?.role !== 'ADMIN') filter.buyerId = req.user?.sub;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    statusCode: 200,
    data: { content: orders, page, size, totalElements: total, totalPages: Math.ceil(total / size), last: page * size >= total },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/orders/:id
app.get('/api/v1/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, statusCode: 404, message: 'Order not found' });
  res.json({ success: true, statusCode: 200, data: order, timestamp: new Date().toISOString() });
});

app.use(errorHandler);

await connectMongo(MONGODB_URI);
app.listen(PORT, () => logger.info(`🚀 Order Service running on port ${PORT}`));
