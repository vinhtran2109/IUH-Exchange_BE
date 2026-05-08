import { Kafka, logLevel } from 'kafkajs';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let kafkaInstance = null;

/**
 * Tạo Kafka client.
 * @param {string} [clientId] - Kafka client ID
 * @returns {{ kafka: Kafka, producer: import('kafkajs').Producer, consumer: import('kafkajs').Consumer }}
 */
export function createKafka(clientId) {
  const kafka = new Kafka({
    clientId: clientId || config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.WARN,
    retry: {
      initialRetryTime: 300,
      retries: 10,
    },
  });

  return kafka;
}

/**
 * Get or create singleton Kafka instance.
 */
export function getKafka(clientId) {
  if (!kafkaInstance) {
    kafkaInstance = createKafka(clientId);
  }
  return kafkaInstance;
}

/**
 * Helper: tạo producer và connect.
 */
export async function createProducer(clientId) {
  const kafka = getKafka(clientId);
  const producer = kafka.producer();
  await producer.connect();
  logger.info('Kafka producer connected');
  return producer;
}

/**
 * Helper: tạo consumer, subscribe và connect.
 * @param {string} groupId - Consumer group ID
 * @param {Array<{topic: string, fromBeginning?: boolean}>} topics
 */
export async function createConsumer(groupId, topics, clientId) {
  const kafka = getKafka(clientId);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();

  for (const { topic, fromBeginning = false } of topics) {
    await consumer.subscribe({ topic, fromBeginning });
  }

  logger.info(`Kafka consumer connected: group=${groupId}`);
  return consumer;
}
