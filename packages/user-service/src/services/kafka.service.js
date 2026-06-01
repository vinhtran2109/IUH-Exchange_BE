import { createProducer, logger } from '@iuh-exchange/common';

let producer = null;

export async function initKafkaProducer() {
  try {
    producer = await createProducer('user-service');
    logger.info('Kafka producer initialized for user-service');
  } catch (err) {
    producer = null;
    logger.error(`User Kafka producer init failed: ${err.message}`);
    throw err; // propagate to caller
  }
}

export async function publishUserEvent(topic, event) {
  if (!producer) {
    const msg = `Kafka producer unavailable, cannot publish event: ${topic}`;
    logger.error(msg);
    throw new Error(msg);
  }

  try {
    await producer.send({
      topic,
      messages: [{ key: event.userId || event.id, value: JSON.stringify(event) }],
    });
    logger.info(`User event published: ${topic}`);
  } catch (err) {
    logger.error(`User event publish failed (${topic}): ${err.message}`);
    throw err;
  }
}
