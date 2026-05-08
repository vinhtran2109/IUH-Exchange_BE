import { Router } from 'express';
import { authenticate, ForbiddenException, ApiResponse, PageResponse, parsePagination, logger } from '@iuh-exchange/common';
import { DlqEvent } from '../models/DlqEvent.js';
import { createProducer } from '@iuh-exchange/common';

// Bug #17 fix: Lazy-initialize Kafka producer for DLQ replay
let dlqProducer = null;
async function getDlqProducer() {
  if (!dlqProducer) {
    dlqProducer = await createProducer('notification-dlq-retry');
  }
  return dlqProducer;
}

const router = Router();

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
  next();
}

router.use(authenticate, requireAdmin);

// GET /api/v1/notifications/dlq — list DLQ events
router.get('/', async (req, res) => {
  const { page, size, skip } = parsePagination(req.query);
  const { status, topic } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (topic) filter.topic = topic;

  const [events, total] = await Promise.all([
    DlqEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
    DlqEvent.countDocuments(filter),
  ]);

  const stats = await DlqEvent.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const pageResponse = new PageResponse({
    content: events,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok({
    ...pageResponse,
    stats: Object.fromEntries(stats.map(s => [s._id, s.count])),
  }));
});

// POST /api/v1/notifications/dlq/:id/retry — retry a DLQ event
router.post('/:id/retry', async (req, res) => {
  const event = await DlqEvent.findById(req.params.id);
  if (!event) return res.status(404).json({ success: false, message: 'Not found' });

  // Bug #17 fix: Actually replay message to original Kafka topic
  try {
    const producer = await getDlqProducer();
    await producer.send({
      topic: event.topic,
      messages: [{
        key: event.key || event._id.toString(),
        value: typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload),
      }],
    });
    event.status = 'RETRYING';
    event.retryCount += 1;
    await event.save();
    logger.info(`DLQ event ${event._id} replayed to topic ${event.topic}`);
    res.json(ApiResponse.ok(event, 'Event replayed to Kafka'));
  } catch (err) {
    logger.error(`DLQ replay failed for ${event._id}: ${err.message}`);
    event.status = 'RETRY_FAILED';
    await event.save();
    res.status(500).json(ApiResponse.error('Failed to replay event'));
  }
});

// DELETE /api/v1/notifications/dlq/:id — dismiss a DLQ event
router.delete('/:id', async (req, res) => {
  await DlqEvent.findByIdAndDelete(req.params.id);
  res.json(ApiResponse.ok(null, 'Dismissed'));
});

export default router;
