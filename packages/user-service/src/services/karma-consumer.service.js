import { createConsumer, logger } from '@iuh-exchange/common';
import { applyKarmaAdjustment } from './karma.service.js';

const GROUP_ID = 'user-service-karma-group';

const TOPICS = [
  { topic: 'order.completed', fromBeginning: false },
  { topic: 'karma.adjustment.requested', fromBeginning: false },
  { topic: 'user.karma.penalty', fromBeginning: false },
];

export async function startKarmaConsumer() {
  let consumer;
  try {
    consumer = await createConsumer(GROUP_ID, TOPICS, 'user-service-karma-consumer');
  } catch (err) {
    logger.warn(`[Karma] Consumer init failed (non-fatal): ${err.message}`);
    return;
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let payload;
      try {
        payload = JSON.parse(message.value?.toString() || '{}');
      } catch (err) {
        logger.error(`[Karma] Invalid message on ${topic}: ${err.message}`);
        return;
      }

      try {
        if (topic === 'order.completed') {
          const orderId = payload.orderId;
          await Promise.all([
            applyKarmaAdjustment({
              userId: payload.sellerId,
              amount: 10,
              reason: 'Hoàn tất giao dịch thành công với vai trò người bán',
              source: 'ORDER_COMPLETED_SELLER',
              relatedId: orderId,
              metadata: { orderId, productId: payload.productId },
            }),
            applyKarmaAdjustment({
              userId: payload.buyerId,
              amount: 5,
              reason: 'Hoàn tất giao dịch thành công với vai trò người mua',
              source: 'ORDER_COMPLETED_BUYER',
              relatedId: orderId,
              metadata: { orderId, productId: payload.productId },
            }),
          ]);
          return;
        }

        if (topic === 'karma.adjustment.requested') {
          await applyKarmaAdjustment({
            userId: payload.userId,
            amount: Number(payload.amount),
            reason: payload.reason,
            source: payload.source || 'ORDER_RESOLUTION',
            relatedId: payload.relatedId || payload.orderId || payload.id,
            performedBy: payload.performedBy || null,
            metadata: payload.metadata || {},
          });
          return;
        }

        if (topic === 'user.karma.penalty') {
          await applyKarmaAdjustment({
            userId: payload.userId,
            amount: -Math.abs(Number(payload.points || payload.amount || 10)),
            reason: payload.reason || 'Vi phạm quy định cộng đồng',
            source: 'LOST_FOUND_PENALTY',
            relatedId: payload.relatedId || payload.reportId || payload.id,
            metadata: payload,
          });
        }
      } catch (err) {
        logger.error(`[Karma] Failed to process ${topic}: ${err.message}`);
      }
    },
  });

  logger.info(`[Karma] Consumer running: group=${GROUP_ID}`);
}
