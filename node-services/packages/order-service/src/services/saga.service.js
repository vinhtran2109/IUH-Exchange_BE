import { createProducer, createConsumer, logger } from '@iuh-exchange/common';

const TOPICS = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COMPLETED: 'order.completed',
  PRODUCT_RESERVED: 'product.reserved',
  PRODUCT_RESERVE_FAILED: 'product.reserve.failed',
};

const CONSUMER_GROUP = 'order-service-group';

let producer = null;

/**
 * Initialize Kafka producer.
 */
export async function initProducer() {
  producer = await createProducer('order-service');
  logger.info('[Saga] Kafka producer ready');
}

/**
 * Publish OrderCreatedEvent to Kafka.
 * Product Service listens on this topic to reserve the product.
 *
 * @param {{ orderId: string, productId: string, buyerId: string, sellerId: string, price: number }} event
 */
export async function publishOrderCreated(event) {
  try {
    await producer.send({
      topic: TOPICS.ORDER_CREATED,
      messages: [
        {
          key: event.orderId,
          value: JSON.stringify(event),
        },
      ],
    });
    logger.info(`[Saga] OrderCreatedEvent published: orderId=${event.orderId}`);
  } catch (err) {
    logger.warn(`[Saga] Kafka unavailable, OrderCreatedEvent not published: ${err.message}`);
  }
}

/**
 * Publish OrderCancelledEvent (compensating transaction).
 *
 * @param {{ orderId: string, productId: string, reason: string }} event
 */
export async function publishOrderCancelled(event) {
  try {
    await producer.send({
      topic: TOPICS.ORDER_CANCELLED,
      messages: [
        {
          key: event.orderId,
          value: JSON.stringify(event),
        },
      ],
    });
    logger.info(`[Saga] OrderCancelledEvent published: orderId=${event.orderId}`);
  } catch (err) {
    logger.warn(`[Saga] Kafka unavailable, OrderCancelledEvent not published: ${err.message}`);
  }
}

/**
 * Publish OrderCompletedEvent.
 * Karma Service listens on this to adjust karma points for buyer and seller.
 *
 * @param {{ orderId: string, buyerId: string, sellerId: string, productId: string }} event
 */
export async function publishOrderCompleted(event) {
  try {
    await producer.send({
      topic: TOPICS.ORDER_COMPLETED,
      messages: [
        {
          key: event.orderId,
          value: JSON.stringify(event),
        },
      ],
    });
    logger.info(
      `[Saga] OrderCompletedEvent published: orderId=${event.orderId}, buyerId=${event.buyerId}, sellerId=${event.sellerId}`
    );
  } catch (err) {
    logger.warn(`[Saga] Kafka unavailable, OrderCompletedEvent not published: ${err.message}`);
  }
}

/**
 * Start Kafka consumer for saga events from Product Service.
 * Listens for product.reserved and product.reserve.failed.
 *
 * @param {import('./order.service.js').OrderService} orderService
 */
export async function startSagaConsumer(orderService) {
  const consumer = await createConsumer(CONSUMER_GROUP, [
    { topic: TOPICS.PRODUCT_RESERVED },
    { topic: TOPICS.PRODUCT_RESERVE_FAILED },
  ], 'order-service-consumer');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = JSON.parse(message.value.toString());

      switch (topic) {
        case TOPICS.PRODUCT_RESERVED: {
          const { orderId } = payload;
          logger.info(`[Saga] ProductReservedEvent received: orderId=${orderId}`);
          await orderService.markAwaitingSellerConfirmation(orderId);
          break;
        }

        case TOPICS.PRODUCT_RESERVE_FAILED: {
          const { orderId, reason } = payload;
          logger.warn(
            `[Saga] ProductReserveFailedEvent received: orderId=${orderId}, reason=${reason}`
          );
          await orderService.cancelOrder(orderId, reason || 'Sản phẩm không còn khả dụng');
          break;
        }

        default:
          logger.warn(`[Saga] Unknown topic: ${topic}`);
      }
    },
  });

  logger.info(`[Saga] Consumer running: group=${CONSUMER_GROUP}`);
}
