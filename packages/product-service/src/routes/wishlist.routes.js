import { Router } from 'express';
import { authenticate } from '@iuh-exchange/common';
import { toggleWishlist, checkWishlist, getMyWishlist } from '../controllers/wishlist.controller.js';

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

// Toggle wishlist (add/remove)
router.post('/:productId/wishlist', toggleWishlist);

// Check if product is wishlisted
router.get('/:productId/wishlist/check', checkWishlist);

// Get user's wishlist
router.get('/me/wishlist', getMyWishlist);

export default router;
