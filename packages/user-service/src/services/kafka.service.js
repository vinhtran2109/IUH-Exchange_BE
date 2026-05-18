import { createProducer, logger } from '@iuh-exchange/common';

let producer = null;

export async function initKafkaProducer() {
  try {
    producer = await createProducer('user-service');
    logger.info('Kafka producer initialized for user-service');
  } catch (err) {
    logger.warn(`User Kafka producer init failed (non-fatal): ${err.message}`);
    producer = null;
  }
}

export async function publishUserEvent(topic, event) {
  if (!producer) {
    logger.warn(`Kafka producer unavailable, skipping event: ${topic}`);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [{ key: event.userId || event.id, value: JSON.stringify(event) }],
    });
    logger.info(`User event published: ${topic}`);
  } catch (err) {
    logger.warn(`User event publish failed (${topic}): ${err.message}`);
  }
}
