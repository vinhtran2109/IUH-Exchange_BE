import express from 'express';
import { config, logger, connectMongo, errorHandler } from '@iuh-exchange/common';
import { Product } from './models/Product.js';

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_products';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service', timestamp: new Date().toISOString() });
});

// ── CRUD Products ──
// GET /api/v1/products - List products (paginated)
app.get('/api/v1/products', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20')));
  const skip = (page - 1) * size;

  const [products, total] = await Promise.all([
    Product.find({ status: 'AVAILABLE' }).sort({ createdAt: -1 }).skip(skip).limit(size),
    Product.countDocuments({ status: 'AVAILABLE' }),
  ]);

  res.json({
    success: true,
    statusCode: 200,
    data: {
      content: products,
      page, size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/v1/products/:id
app.get('/api/v1/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, statusCode: 404, message: 'Product not found' });
  res.json({ success: true, statusCode: 200, data: product, timestamp: new Date().toISOString() });
});

// POST /api/v1/products - Create (authenticated)
app.post('/api/v1/products', async (req, res) => {
  // TODO: authenticate middleware + S3 presigned URL
  const product = await Product.create({ ...req.body, sellerId: req.user?.sub });
  res.status(201).json({ success: true, statusCode: 201, data: product, timestamp: new Date().toISOString() });
});

// PUT /api/v1/products/:id
app.put('/api/v1/products/:id', async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!product) return res.status(404).json({ success: false, statusCode: 404, message: 'Product not found' });
  res.json({ success: true, statusCode: 200, data: product, timestamp: new Date().toISOString() });
});

// DELETE /api/v1/products/:id
app.delete('/api/v1/products/:id', async (req, res) => {
  await Product.findByIdAndUpdate(req.params.id, { status: 'REMOVED' });
  res.json({ success: true, statusCode: 200, message: 'Product removed', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

await connectMongo(MONGODB_URI);
app.listen(PORT, () => logger.info(`🚀 Product Service running on port ${PORT}`));
