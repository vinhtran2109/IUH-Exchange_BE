import { createConsumer, logger } from '@iuh-exchange/common';
import { Product } from '../models/Product.js';
import { publishProductEvent } from './kafka.service.js';

/**
 * Saga listener: handles order lifecycle events that affect product status.
 *
 * - order.created   → Reserve product (AVAILABLE → PENDING)
 * - order.completed → Mark product as SOLD
 * - order.cancelled → Release product back to AVAILABLE
 */
export async function initSagaListener() {
  try {
    const consumer = await createConsumer('product-service-saga-group', [
      { topic: 'order.created' },
      { topic: 'order.completed' },
      { topic: 'order.cancelled' },
    ]);

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const payload = JSON.parse(message.value.toString());

        switch (topic) {
          case 'order.created':
            await handleOrderCreated(payload);
            break;
          case 'order.completed':
            await handleOrderCompleted(payload);
            break;
          case 'order.cancelled':
            await handleOrderCancelled(payload);
            break;
        }
      },
    });

    logger.info('Saga listener initialized');
  } catch (err) {
    logger.error(`Saga listener init failed: ${err.message}`);
  }
}

async function handleOrderCreated(payload) {
  const { orderId, productId } = payload;
  logger.info(`[SAGA] OrderCreated: orderId=${orderId}, productId=${productId}`);

  const product = await Product.findById(productId);
  if (!product) {
    logger.warn(`[SAGA] Product not found: ${productId}`);
    await publishProductEvent('product.reserve.failed', { id: orderId, orderId, productId, reason: 'Product not found' });
    return;
  }

  if (product.status !== 'AVAILABLE') {
    logger.warn(`[SAGA] Product not available: ${productId}, status=${product.status}`);
    await publishProductEvent('product.reserve.failed', { id: orderId, orderId, productId, reason: `Product not available (status=${product.status})` });
    return;
  }

  product.status = 'PENDING';
  await product.save();
  logger.info(`[SAGA] Product reserved: ${productId}`);

  await publishProductEvent('product.reserved', { id: orderId, orderId, productId });
}

async function handleOrderCompleted(payload) {
  const { orderId, productId } = payload;
  if (!productId) {
    logger.warn(`[SAGA] Order completed without productId: ${orderId}`);
    return;
  }

  const product = await Product.findById(productId);
  if (product) {
    product.status = 'SOLD';
    await product.save();
    logger.info(`[SAGA] Product marked as SOLD: ${productId}`);
  }
}

async function handleOrderCancelled(payload) {
  const { productId, reason } = payload;
  if (!productId) {
    logger.warn(`[SAGA] Order cancelled without productId, reason=${reason}`);
    return;
  }

  const product = await Product.findById(productId);
  if (product && product.status === 'PENDING') {
    product.status = 'AVAILABLE';
    await product.save();
    logger.info(`[SAGA] Product released: ${productId}, reason=${reason}`);
  }
}
