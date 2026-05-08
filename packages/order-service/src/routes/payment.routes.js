import { Router } from 'express';
import { verifyGatewaySignature } from '@iuh-exchange/common';
import {
  createPayment,
  paymentCallback,
  processRefund,
  getPaymentDetails,
} from '../controllers/payment.controller.js';

const router = Router();

// Verify gateway-signed headers on all payment routes
router.use(verifyGatewaySignature);

/**
 * POST /api/v1/orders/:id/payment/create
 * Create mock VNPay payment URL
 */
router.post('/:id/payment/create', (req, res, next) => {
  createPayment(req, res).catch(next);
});

/**
 * POST /api/v1/orders/:id/payment/callback
 * Mock VNPay callback
 */
router.post('/:id/payment/callback', (req, res, next) => {
  paymentCallback(req, res).catch(next);
});

/**
 * POST /api/v1/orders/:id/payment/refund
 * Process refund for cancelled order
 */
router.post('/:id/payment/refund', (req, res, next) => {
  processRefund(req, res).catch(next);
});

/**
 * GET /api/v1/orders/:id/payment
 * Get payment details
 */
router.get('/:id/payment', (req, res, next) => {
  getPaymentDetails(req, res).catch(next);
});

export default router;
