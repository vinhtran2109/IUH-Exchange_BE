import { Router } from 'express';
import { authenticate, authorize, optionalAuth, ForbiddenException } from '@iuh-exchange/common';
import {
  listItems,
  listAdminItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  deleteItemAsAdmin,
  claimItem,
  reviewClaim,
  getUploadUrl,
  getMatches,
  previewMatches,
  getHeatmapData,
  bulkModerate,
} from '../controllers/lostfound.controller.js';
import { ocrRateLimit } from '../middleware/ocr-rate-limit.js';

const router = Router();

function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
  next();
}

function canModerateLostFound(req, _res, next) {
  if (
    req.user?.role === 'ADMIN' ||
    (req.user?.role === 'MODERATOR' && req.user?.permissions?.includes('CAN_REPORT'))
  ) {
    return next();
  }
  throw new ForbiddenException('Lost-found moderation access required');
}

// Public: browse items (optional auth to know user if logged in)
router.get('/', optionalAuth, listItems);

// Admin: list/delete all items
router.get('/admin', authenticate, canModerateLostFound, listAdminItems);
router.get('/admin/heatmap', authenticate, adminOnly, getHeatmapData);
router.post('/admin/bulk-moderate', authenticate, canModerateLostFound, bulkModerate);
router.delete('/admin/:id', authenticate, canModerateLostFound, deleteItemAsAdmin);

// Protected: mutations require authentication
router.post('/', authenticate, authorize('CAN_REPORT'), ocrRateLimit, createItem);

// Upload presigned URL (must be before /:id)
router.post('/upload-url', authenticate, authorize('CAN_REPORT'), getUploadUrl);

// Match preview (before creating) — must be before /:id
router.post('/match-preview', optionalAuth, previewMatches);

// Public: view single item
router.get('/:id', optionalAuth, getItemById);

// Find matches for an existing item
router.get('/:id/matches', optionalAuth, getMatches);

// Protected: update/delete/claim
router.put('/:id', authenticate, authorize('CAN_REPORT'), updateItem);
router.delete('/:id', authenticate, deleteItem);
router.post('/:id/claim', authenticate, authorize('CAN_REPORT'), claimItem);
router.patch('/:id/claims/:claimId', authenticate, authorize('CAN_REPORT'), reviewClaim);

export default router;
