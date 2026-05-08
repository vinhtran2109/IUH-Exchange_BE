import { Router } from 'express';
import { authenticate, validate } from '@iuh-exchange/common';
import { createReview, getProductReviews, checkReviewExists, getSellerReviews } from '../controllers/review.controller.js';

const router = Router();

// Public: get reviews for a product
router.get('/:productId/reviews', getProductReviews);

// Public: get reviews for a seller
router.get('/seller/:userId/reviews', getSellerReviews);

// Authenticated: create review
router.post('/:productId/reviews', authenticate, createReview);

// Authenticated: check if review exists
router.get('/:productId/reviews/check', authenticate, checkReviewExists);

export default router;
