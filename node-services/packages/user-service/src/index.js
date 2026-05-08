import express from 'express';
import {
  config,
  logger,
  connectMongo,
  errorHandler,
} from '@iuh-exchange/common';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_users';

// ── Middleware ──
app.use(express.json());

// ── Health ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() });
});

// ── Routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);

// ── Error handler ──
app.use(errorHandler);

// ── Start ──
await connectMongo(MONGODB_URI);

app.listen(PORT, () => {
  logger.info(`🚀 User Service running on port ${PORT}`);
});
