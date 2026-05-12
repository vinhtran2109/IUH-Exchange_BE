import { Router } from 'express';
import { authenticate, ForbiddenException, validate } from '@iuh-exchange/common';
import {
  createProductSchema,
  uploadUrlSchema,
  paginationSchema,
  adminProductListSchema,
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
  deleteProductAsAdmin,
  getUploadUrl,
  getPendingProducts,
  listAdminProducts,
  resolveProduct,
  getProductStats,
} from '../controllers/product.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validateBody(schema) {
  return validate(schema, 'body');
}

function validateQuery(schema) {
  return validate(schema, 'query');
}

function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new ForbiddenException('Admin access required'));
  }
  next();
}

router.get('/admin/pending', authenticate, adminOnly, validateQuery(paginationSchema), asyncHandler(getPendingProducts));
router.get('/admin', authenticate, adminOnly, validateQuery(adminProductListSchema), asyncHandler(listAdminProducts));
router.patch('/admin/:id/resolve', authenticate, adminOnly, asyncHandler(resolveProduct));
router.delete('/admin/:id', authenticate, adminOnly, asyncHandler(deleteProductAsAdmin));
router.get('/admin/stats', authenticate, adminOnly, asyncHandler(getProductStats));

router.get('/search', validateQuery(searchSchema), asyncHandler(searchProductsHandler));
router.get('/', validateQuery(paginationSchema), asyncHandler(listProducts));

router.get('/me', authenticate, validateQuery(paginationSchema), asyncHandler(getMyProducts));
router.post('/', authenticate, validateBody(createProductSchema), asyncHandler(createProduct));
router.post('/upload-url', authenticate, validateBody(uploadUrlSchema), asyncHandler(getUploadUrl));

router.get('/:id', asyncHandler(getProductById));
router.put('/:id', authenticate, validateBody(createProductSchema), asyncHandler(updateProduct));
router.delete('/:id', authenticate, asyncHandler(deleteProduct));

export default router;
