import { Router } from 'express';
import { authenticate, ForbiddenException, validate } from '@iuh-exchange/common';
import {
  createProductSchema,
  uploadUrlSchema,
  paginationSchema,
  searchSchema,
} from '../validations/product.validation.js';
import {
  listProducts,
  searchProductsHandler,
  getMyProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getUploadUrl,
  getPendingProducts,
  resolveProduct,
  getProductStats,
} from '../controllers/product.controller.js';

const router = Router();

function validateBody(schema) {
  return validate(schema, 'body');
}
function validateQuery(schema) {
  return validate(schema, 'query');
}

function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
  next();
}

// ── Admin Routes (MUST be before /:id to avoid conflicts) ──

router.get('/admin/pending', authenticate, adminOnly, validateQuery(paginationSchema), getPendingProducts);
router.patch('/admin/:id/resolve', authenticate, adminOnly, resolveProduct);
router.get('/admin/stats', authenticate, adminOnly, getProductStats);

// ── Public Routes ──

router.get('/search', validateQuery(searchSchema), searchProductsHandler);
router.get('/', validateQuery(paginationSchema), listProducts);

// ── Authenticated Routes ──

router.get('/me', authenticate, validateQuery(paginationSchema), getMyProducts);
router.post('/', authenticate, validateBody(createProductSchema), createProduct);
router.post('/upload-url', authenticate, validateBody(uploadUrlSchema), getUploadUrl);

// ── Parameterized Routes (must come after static paths) ──

router.get('/:id', getProductById);
router.put('/:id', authenticate, validateBody(createProductSchema), updateProduct);
router.delete('/:id', authenticate, deleteProduct);

export default router;
