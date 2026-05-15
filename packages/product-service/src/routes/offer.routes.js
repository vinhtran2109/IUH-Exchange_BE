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

router.use(authenticate);

router.get('/offers/me', asyncHandler(listMyOffers));
router.post('/:productId/offers', asyncHandler(createOffer));
router.get('/:productId/offers', asyncHandler(listProductOffers));
router.patch('/offers/:offerId/resolve', asyncHandler(resolveOffer));
router.patch('/offers/:offerId/withdraw', asyncHandler(withdrawOffer));

export default router;
