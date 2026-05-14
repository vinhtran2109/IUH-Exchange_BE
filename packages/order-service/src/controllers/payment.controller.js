import crypto from 'crypto';
import { Order } from '../models/Order.js';
import {
  ApiResponse,
  BadRequestException,
  ResourceNotFoundException,
  ForbiddenException,
  logger,
} from '@iuh-exchange/common';

/**
 * POST /api/v1/orders/:id/payment/create
 * Create a mock VNPay payment URL for an order.
 * Simulates the VNPay payment gateway flow.
 */
export async function createPayment(req, res) {
  const userId = req.user?.sub || req.headers['x-user-id'];
  if (!userId) throw new BadRequestException('Missing X-User-Id header');

  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) throw new ResourceNotFoundException('Order', orderId);

  if (String(order.buyerId) !== String(userId)) {
    throw new ForbiddenException('Chỉ người mua mới có thể thanh toán đơn hàng');
  }

  if (order.paymentStatus === 'PAID') {
    throw new BadRequestException('Đơn hàng đã được thanh toán');
  }

  if (order.status === 'CANCELLED') {
    throw new BadRequestException('Đơn hàng đã bị hủy, không thể thanh toán');
  }

  // Generate mock VNPay transaction ID
  const transactionId = `VNPAY_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Mock VNPay payment URL
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const paymentUrl = `${baseUrl}/payment/callback?orderId=${orderId}&transactionId=${transactionId}&status=success`;

  order.paymentMethod = 'VNPAY_MOCK';
  order.paymentTransactionId = transactionId;
  order.transactions = order.transactions || [];
  order.transactions.push({
    type: 'PAYMENT_CREATED',
    transactionId,
    amount: order.price,
    method: 'VNPAY_MOCK',
    status: 'PENDING',
    note: 'Mock VNPay payment link created',
  });
  await order.save();

  logger.info(`[Payment] Mock VNPay payment created: orderId=${orderId}, txnId=${transactionId}`);

  res.json(ApiResponse.ok({
    paymentUrl,
    transactionId,
    orderId,
    amount: order.price,
    method: 'VNPAY_MOCK',
  }, 'Tạo link thanh toán thành công'));
}

/**
 * POST /api/v1/orders/:id/payment/callback
 * Mock VNPay callback - simulates payment completion.
 * In production, this would verify the VNPay response signature.
 */
export async function paymentCallback(req, res) {
  const orderId = req.params.id;
  const { transactionId, status } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new ResourceNotFoundException('Order', orderId);

  if (order.paymentStatus === 'PAID') {
    throw new BadRequestException('Đơn hàng đã được thanh toán trước đó');
  }

  if (!transactionId || transactionId !== order.paymentTransactionId) {
    throw new BadRequestException('Mã giao dịch không hợp lệ');
  }

  if (status === 'success') {
    order.paymentStatus = 'PAID';
    order.paidAt = new Date();
    order.transactions = order.transactions || [];
    order.transactions.push({
      type: 'PAYMENT_CAPTURED',
      transactionId,
      amount: order.price,
      method: order.paymentMethod,
      status: 'SUCCESS',
      note: 'Payment completed',
    });
    await order.save();

    logger.info(`[Payment] Payment confirmed: orderId=${orderId}, txnId=${transactionId}`);
    res.json(ApiResponse.ok({
      orderId,
      transactionId,
      paymentStatus: 'PAID',
      paidAt: order.paidAt,
    }, 'Thanh toán thành công'));
  } else {
    order.transactions = order.transactions || [];
    order.transactions.push({
      type: 'PAYMENT_FAILED',
      transactionId,
      amount: order.price,
      method: order.paymentMethod,
      status: 'FAILED',
      note: `Payment callback status: ${status || 'unknown'}`,
    });
    await order.save();
    logger.warn(`[Payment] Payment failed: orderId=${orderId}, txnId=${transactionId}, status=${status}`);
    res.json(ApiResponse.ok({
      orderId,
      transactionId,
      paymentStatus: order.paymentStatus,
    }, 'Thanh toán thất bại'));
  }
}

/**
 * POST /api/v1/orders/:id/payment/refund
 * Process a mock refund for a cancelled order.
 */
export async function processRefund(req, res) {
  const userId = req.user?.sub || req.headers['x-user-id'];
  if (!userId) throw new BadRequestException('Missing X-User-Id header');

  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) throw new ResourceNotFoundException('Order', orderId);

  // Only buyer or seller can request refund
  if (String(order.buyerId) !== String(userId) && String(order.sellerId) !== String(userId)) {
    throw new ForbiddenException('Bạn không có quyền yêu cầu hoàn tiền cho đơn này');
  }

  if (order.paymentStatus === 'REFUNDED') {
    throw new BadRequestException('Đơn hàng đã được hoàn tiền trước đó');
  }

  if (order.paymentStatus !== 'PAID') {
    throw new BadRequestException('Đơn hàng chưa được thanh toán, không thể hoàn tiền');
  }

  if (order.status !== 'CANCELLED') {
    throw new BadRequestException('Chỉ có thể hoàn tiền cho đơn hàng đã bị hủy');
  }

  order.paymentStatus = 'REFUNDED';
  order.refundedAt = new Date();
  order.transactions = order.transactions || [];
  order.transactions.push({
    type: 'REFUND_CREATED',
    transactionId: order.paymentTransactionId,
    amount: order.price,
    method: order.paymentMethod,
    status: 'REFUNDED',
    note: 'Refund processed for cancelled order',
  });
  await order.save();

  logger.info(`[Payment] Refund processed: orderId=${orderId}, amount=${order.price}`);

  res.json(ApiResponse.ok({
    orderId,
    paymentStatus: 'REFUNDED',
    refundedAt: order.refundedAt,
    amount: order.price,
  }, 'Hoàn tiền thành công'));
}

/**
 * GET /api/v1/orders/:id/payment
 * Get payment details for an order.
 */
export async function getPaymentDetails(req, res) {
  const orderId = req.params.id;
  const order = await Order.findById(orderId).lean();
  if (!order) throw new ResourceNotFoundException('Order', orderId);

  res.json(ApiResponse.ok({
    orderId,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    transactionId: order.paymentTransactionId,
    amount: order.price,
    paidAt: order.paidAt,
    refundedAt: order.refundedAt,
    transactions: order.transactions || [],
  }));
}
