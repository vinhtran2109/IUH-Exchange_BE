import { Router } from 'express';
import { authenticate } from '@iuh-exchange/common';
import {
  checkSellerFollow,
  getMyViewHistory,
  getSellerTrustProfile,
  recordProductView,
  toggleSellerFollow,
} from '../controllers/trust.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/sellers/:sellerId/trust', asyncHandler(getSellerTrustProfile));
router.post('/sellers/:sellerId/follow', authenticate, asyncHandler(toggleSellerFollow));
router.get('/sellers/:sellerId/follow/check', authenticate, asyncHandler(checkSellerFollow));
router.post('/:productId/view', authenticate, asyncHandler(recordProductView));
router.get('/me/history', authenticate, asyncHandler(getMyViewHistory));

export default router;
