import { Router } from 'express';
import { authenticate, optionalAuth } from '@iuh-exchange/common';
import {
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  claimItem,
  getUploadUrl,
} from '../controllers/lostfound.controller.js';

const router = Router();

// Public: browse items (optional auth to know user if logged in)
router.get('/', optionalAuth, listItems);

// Protected: mutations require authentication
router.post('/', authenticate, createItem);

// Upload presigned URL (must be before /:id)
router.post('/upload-url', authenticate, getUploadUrl);

// Public: view single item
router.get('/:id', optionalAuth, getItemById);

// Protected: update/delete/claim
router.put('/:id', authenticate, updateItem);
router.delete('/:id', authenticate, deleteItem);
router.post('/:id/claim', authenticate, claimItem);

export default router;
