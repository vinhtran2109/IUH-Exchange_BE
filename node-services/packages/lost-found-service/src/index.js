import express from 'express';
import { config, logger, connectMongo, errorHandler } from '@iuh-exchange/common';
import { LostFoundItem, Report } from './models/LostFound.js';

const app = express();
const PORT = process.env.PORT || 3006;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iuh_lostfound';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'lost-found-service', timestamp: new Date().toISOString() });
});

// ── Lost & Found CRUD ──
app.get('/api/v1/lost-found', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const size = Math.min(100, parseInt(req.query.size || '20'));
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    LostFoundItem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size),
    LostFoundItem.countDocuments(filter),
  ]);

  res.json({
    success: true,
    statusCode: 200,
    data: { content: items, page, size, totalElements: total, totalPages: Math.ceil(total / size), last: page * size >= total },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/lost-found/:id', async (req, res) => {
  const item = await LostFoundItem.findById(req.params.id);
  if (!item) return res.status(404).json({ success: false, statusCode: 404, message: 'Item not found' });
  res.json({ success: true, statusCode: 200, data: item, timestamp: new Date().toISOString() });
});

app.post('/api/v1/lost-found', async (req, res) => {
  const item = await LostFoundItem.create({ ...req.body, userId: req.user?.sub });
  res.status(201).json({ success: true, statusCode: 201, data: item, timestamp: new Date().toISOString() });
});

app.put('/api/v1/lost-found/:id', async (req, res) => {
  const item = await LostFoundItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json({ success: false, statusCode: 404, message: 'Item not found' });
  res.json({ success: true, statusCode: 200, data: item, timestamp: new Date().toISOString() });
});

// ── Reports ──
app.post('/api/v1/reports', async (req, res) => {
  const report = await Report.create({ ...req.body, reporterId: req.user?.sub });
  res.status(201).json({ success: true, statusCode: 201, data: report, timestamp: new Date().toISOString() });
});

app.get('/api/v1/reports', async (req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, statusCode: 200, data: reports, timestamp: new Date().toISOString() });
});

app.use(errorHandler);

await connectMongo(MONGODB_URI);
app.listen(PORT, () => logger.info(`🚀 Lost & Found Service running on port ${PORT}`));
