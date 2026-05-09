import { Router } from 'express';
import { authenticate } from '@iuh-exchange/common';
import { toggleWishlist, checkWishlist, getMyWishlist } from '../controllers/wishlist.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All wishlist routes require authentication
router.use(authenticate);

// Toggle wishlist (add/remove)
router.post('/:productId/wishlist', asyncHandler(toggleWishlist));

// Check if product is wishlisted
router.get('/:productId/wishlist/check', asyncHandler(checkWishlist));

// Get user's wishlist
router.get('/me/wishlist', asyncHandler(getMyWishlist));

export default router;
