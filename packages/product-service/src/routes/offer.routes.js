import { Router } from 'express';
import { authenticate, verifyGatewaySignature } from '@iuh-exchange/common';
import {
  createOffer,
  listProductOffers,
  listMyOffers,
  resolveOffer,
  withdrawOffer,
  getOfferCheckout,
} from '../controllers/offer.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/offers/:offerId/checkout', verifyGatewaySignature, asyncHandler(getOfferCheckout));

router.get('/offers/me', authenticate, asyncHandler(listMyOffers));
router.post('/:productId/offers', authenticate, asyncHandler(createOffer));
router.get('/:productId/offers', authenticate, asyncHandler(listProductOffers));
router.patch('/offers/:offerId/resolve', authenticate, asyncHandler(resolveOffer));
router.patch('/offers/:offerId/withdraw', authenticate, asyncHandler(withdrawOffer));

export default router;
