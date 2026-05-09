import { Router } from 'express';
import { authenticate, validate } from '@iuh-exchange/common';
import { createReview, getProductReviews, checkReviewExists, getSellerReviews } from '../controllers/review.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public: get reviews for a product
router.get('/:productId/reviews', asyncHandler(getProductReviews));

// Public: get reviews for a seller
router.get('/seller/:userId/reviews', asyncHandler(getSellerReviews));

// Authenticated: create review
router.post('/:productId/reviews', authenticate, asyncHandler(createReview));

// Authenticated: check if review exists
router.get('/:productId/reviews/check', authenticate, asyncHandler(checkReviewExists));

export default router;
