import { createProducer, logger } from '@iuh-exchange/common';

let producer = null;

const TOPICS = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
};

/**
 * Initialize the Kafka producer. Call once at startup.
 * Throws on failure so the caller can decide to exit.
 */
export async function initKafkaProducer() {
  try {
    producer = await createProducer('product-service');
    logger.info('Kafka producer initialized for product-service');
  } catch (err) {
    producer = null;
    logger.error(`Kafka producer init failed: ${err.message}`);
    throw err; // propagate to caller
  }
}

/**
 * Publish a product event to Kafka.
 * @param {'product.created'|'product.updated'|'product.deleted'} topic
 * @param {object} event - Event payload
 */
export async function publishProductEvent(topic, event) {
  if (!producer) {
    const msg = `Kafka producer not available, cannot publish event: ${topic}`;
    logger.error(msg);
    throw new Error(msg);
  }
  try {
    await producer.send({
      topic,
      messages: [{ key: event.id, value: JSON.stringify(event) }],
    });
    logger.info(`Kafka event published: ${topic} for product ${event.id}`);
  } catch (err) {
    logger.error(`Kafka publish failed (${topic}): ${err.message}`);
    throw err;
  }
}

export { TOPICS };
