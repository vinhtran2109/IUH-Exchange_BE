import { createProducer, logger } from '@iuh-exchange/common';

let producer = null;

const KARMA_TOPIC = 'user.karma.penalty';
const KARMA_PENALTY_POINTS = 5;
const LOSTFOUND_ANALYZED_TOPIC = 'lostfound.analyzed';
const LOSTFOUND_MATCH_TOPIC = 'lostfound.match';
const REPORT_RESOLVED_TOPIC = 'report.resolved';

/**
 * Initialize Kafka producer. Call once at startup.
 * Throws on failure so the caller can handle it.
 */
export async function initKafka() {
  try {
    producer = await createProducer('lost-found-service');
    logger.info('Lost-found Kafka producer ready');
  } catch (err) {
    producer = null;
    logger.error(`Kafka producer init failed: ${err.message}`);
    throw err; // propagate to caller
  }
}

/**
 * Publish a lostfound.analyzed event.
 * Consumed by notification-service to inform the user about analysis results.
 *
 * @param {object} payload
 * @param {string} payload.itemId
 * @param {string} payload.userId
 * @param {string} payload.type - LOST | FOUND
 * @param {string} payload.title
 * @param {string} payload.detectedType
 * @param {string} payload.studentId - Extracted MSSV
 * @param {number} payload.confidence
 * @param {string} payload.category
 */
export async function publishLostFoundAnalyzed(payload) {
  if (!producer) {
    logger.warn('Kafka producer unavailable, skipping lostfound.analyzed event');
    return;
  }

  try {
    await producer.send({
      topic: LOSTFOUND_ANALYZED_TOPIC,
      messages: [
        {
          key: payload.itemId,
          value: JSON.stringify({
            ...payload,
            source: 'lost-found-service',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info(`LostFound analyzed event published for item ${payload.itemId}`);
  } catch (err) {
    logger.error(`Failed to publish lostfound.analyzed for item ${payload.itemId}: ${err.message}`);
  }
}

/**
 * Publish a lostfound.match event.
 * Consumed by notification-service to notify users about potential matches.
 *
 * @param {object} payload
 * @param {string} payload.itemId
 * @param {string} payload.userId
 * @param {string} payload.type - LOST | FOUND
 * @param {string} payload.title
 * @param {Array} payload.matches - [{ itemId, title, score, ownerId }]
 */
export async function publishLostFoundMatch(payload) {
  if (!producer) {
    logger.warn('Kafka producer unavailable, skipping lostfound.match event');
    return;
  }

  try {
    await producer.send({
      topic: LOSTFOUND_MATCH_TOPIC,
      messages: [
        {
          key: payload.itemId,
          value: JSON.stringify({
            ...payload,
            source: 'lost-found-service',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info(`LostFound match event published for item ${payload.itemId}: ${payload.matches.length} matches`);
  } catch (err) {
    logger.error(`Failed to publish lostfound.match for item ${payload.itemId}: ${err.message}`);
  }
}

/**
 * Publish a karma penalty event for a reported & verified user.
 * @param {string} userId - The reported user
 * @param {string} reason - Report reason
 */
export async function publishKarmaPenalty(userId, reason) {
  if (!producer) {
    logger.warn('Kafka producer unavailable, skipping karma penalty event');
    return;
  }

  try {
    await producer.send({
      topic: KARMA_TOPIC,
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            pointsToDeduct: KARMA_PENALTY_POINTS,
            reason,
            source: 'lost-found-service',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info(`Karma penalty event published for user ${userId}: -${KARMA_PENALTY_POINTS} points`);
  } catch (err) {
    logger.error(`Failed to publish karma penalty for user ${userId}: ${err.message}`);
  }
}

/**
 * Notify the reporter when a moderation report has been reviewed.
 * @param {object} payload
 * @param {string} payload.reportId
 * @param {string} payload.reporterId
 * @param {string} payload.status
 * @param {string} payload.targetType
 * @param {string} payload.targetId
 * @param {string} payload.adminNote
 */
export async function publishReportResolved(payload) {
  if (!producer) {
    logger.warn('Kafka producer unavailable, skipping report.resolved event');
    return;
  }

  try {
    await producer.send({
      topic: REPORT_RESOLVED_TOPIC,
      messages: [
        {
          key: payload.reportId,
          value: JSON.stringify({
            ...payload,
            source: 'lost-found-service',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    logger.info(`Report resolved event published for report ${payload.reportId}`);
  } catch (err) {
    logger.error(`Failed to publish report.resolved for report ${payload.reportId}: ${err.message}`);
  }
}

export async function publishLostFoundEvent(topic, event) {
  if (!producer) {
    logger.warn(`Kafka producer unavailable, skipping ${topic}`);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [{ key: event.id || event.itemId || event.claimId, value: JSON.stringify(event) }],
    });
    logger.info(`Lost-found event published: ${topic}`);
  } catch (err) {
    logger.error(`Failed to publish ${topic}: ${err.message}`);
  }
}
