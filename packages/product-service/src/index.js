import express from 'express';
import { config, logger, connectMongo, errorHandler } from '@iuh-exchange/common';
import productRoutes from './routes/product.routes.js';
import reviewRoutes from './routes/review.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import { initKafkaProducer } from './services/kafka.service.js';
import { ensureIndex } from './services/elasticsearch.service.js';
import { initSagaListener } from './services/saga.listener.js';

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_products';

// ── Middleware ──
app.use(express.json());

// ── Health ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service', timestamp: new Date().toISOString() });
});

// ── Routes ──
app.use('/api/v1/products', reviewRoutes);
app.use('/api/v1/products', wishlistRoutes);
app.use('/api/v1/products', productRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
await connectMongo(MONGODB_URI);
await initKafkaProducer();
await ensureIndex();
await initSagaListener();

app.listen(PORT, () => {
  logger.info(`🚀 Product Service running on port ${PORT}`);
});
