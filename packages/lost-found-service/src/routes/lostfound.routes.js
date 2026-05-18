import { Router } from 'express';
import { authenticate, optionalAuth, ForbiddenException } from '@iuh-exchange/common';
import {
  listItems,
  listAdminItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  deleteItemAsAdmin,
  claimItem,
  getUploadUrl,
  getMatches,
  previewMatches,
} from '../controllers/lostfound.controller.js';

const router = Router();

function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
  next();
}

// Public: browse items (optional auth to know user if logged in)
router.get('/', optionalAuth, listItems);

// Admin: list/delete all items
router.get('/admin', authenticate, adminOnly, listAdminItems);
router.delete('/admin/:id', authenticate, adminOnly, deleteItemAsAdmin);

// Protected: mutations require authentication
router.post('/', authenticate, createItem);

// Upload presigned URL (must be before /:id)
router.post('/upload-url', authenticate, getUploadUrl);

// Match preview (before creating) — must be before /:id
router.post('/match-preview', optionalAuth, previewMatches);

// Public: view single item
router.get('/:id', optionalAuth, getItemById);

// Find matches for an existing item
router.get('/:id/matches', optionalAuth, getMatches);

// Protected: update/delete/claim
router.put('/:id', authenticate, updateItem);
router.delete('/:id', authenticate, deleteItem);
router.post('/:id/claim', authenticate, claimItem);

export default router;
