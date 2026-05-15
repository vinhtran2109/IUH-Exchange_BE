import { createConsumer, logger } from '@iuh-exchange/common';
import { Product } from '../models/Product.js';
import { publishProductEvent } from './kafka.service.js';

const RESERVATION_TTL_MINUTES = Number(process.env.PRODUCT_RESERVATION_TTL_MINUTES || 30);

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
        // Bug #15 fix: Handle corrupt Kafka messages gracefully
        let payload;
        try {
          payload = JSON.parse(message.value.toString());
        } catch (parseErr) {
          logger.error(`[SAGA] Failed to parse Kafka message on topic ${topic}: ${parseErr.message}`);
          return; // Skip invalid message
        }

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
  const { orderId, productId, buyerId } = payload;
  logger.info(`[SAGA] OrderCreated: orderId=${orderId}, productId=${productId}`);

  const product = await Product.findById(productId);
  if (!product) {
    logger.warn(`[SAGA] Product not found: ${productId}`);
    await publishProductEvent('product.reserve.failed', { id: orderId, orderId, productId, reason: 'Product not found' });
    return;
  }

  if ((product.status === 'RESERVED' || product.status === 'PENDING') && product.reservedOrderId === orderId) {
    logger.info(`[SAGA] Product already reserved: ${productId}, skipping`);
    await publishProductEvent('product.reserved', { id: orderId, orderId, productId, sellerId: product.sellerId, buyerId });
    return;
  }

  if (product.status !== 'AVAILABLE') {
    logger.warn(`[SAGA] Product not available: ${productId}, status=${product.status}`);
    await publishProductEvent('product.reserve.failed', { id: orderId, orderId, productId, reason: `Product not available (status=${product.status})` });
    return;
  }

  const reserved = await Product.findOneAndUpdate(
    { _id: productId, status: 'AVAILABLE' },
    {
      status: 'RESERVED',
      reservedOrderId: orderId,
      reservedBy: buyerId || null,
      reservedAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
    },
    { new: true }
  );

  if (!reserved) {
    await publishProductEvent('product.reserve.failed', { id: orderId, orderId, productId, reason: 'Product was reserved by another order' });
    return;
  }
  logger.info(`[SAGA] Product reserved: ${productId}`);

  await publishProductEvent('product.reserved', { id: orderId, orderId, productId, sellerId: reserved.sellerId, buyerId });
}

async function handleOrderCompleted(payload) {
  const { orderId, productId } = payload;
  if (!productId) {
    logger.warn(`[SAGA] Order completed without productId: ${orderId}`);
    return;
  }

  const product = await Product.findById(productId);
  if (product) {
    if (product.status === 'SOLD') {
      logger.info(`[SAGA] Product already marked as SOLD: ${productId}, skipping`);
      return;
    }
    product.status = 'SOLD';
    product.reservedOrderId = null;
    product.reservedBy = null;
    product.reservedAt = null;
    product.reservationExpiresAt = null;
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
  if (product && (product.status === 'RESERVED' || product.status === 'PENDING') && (!product.reservedOrderId || product.reservedOrderId === payload.orderId)) {
    product.status = 'AVAILABLE';
    product.reservedOrderId = null;
    product.reservedBy = null;
    product.reservedAt = null;
    product.reservationExpiresAt = null;
    await product.save();
    logger.info(`[SAGA] Product released: ${productId}, reason=${reason}`);
  }
}

export async function releaseExpiredReservations(now = new Date()) {
  const expiredProducts = await Product.find({
    status: 'RESERVED',
    reservationExpiresAt: { $lte: now },
  });

  for (const product of expiredProducts) {
    const orderId = product.reservedOrderId;
    const buyerId = product.reservedBy;
    const sellerId = product.sellerId;
    product.status = 'AVAILABLE';
    product.reservedOrderId = null;
    product.reservedBy = null;
    product.reservedAt = null;
    product.reservationExpiresAt = null;
    await product.save();

    if (orderId) {
      await publishProductEvent('product.reserve.expired', {
        id: orderId,
        orderId,
        productId: product._id.toString(),
        buyerId,
        sellerId,
        reason: 'Reservation expired',
      });
    }
  }

  return expiredProducts.length;
}
