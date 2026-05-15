import { createProducer, logger } from '@iuh-exchange/common';

let producer = null;

const KARMA_TOPIC = 'user.karma.penalty';
const KARMA_PENALTY_POINTS = 5;

/**
 * Initialize Kafka producer. Call once at startup.
 */
export async function initKafka() {
  try {
    producer = await createProducer('lost-found-service');
    logger.info('Lost-found Kafka producer ready');
  } catch (err) {
    logger.warn(`Kafka producer init failed (non-fatal): ${err.message}`);
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
