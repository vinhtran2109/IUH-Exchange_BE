import { Router } from 'express';
import { authenticate, authorize, ForbiddenException, validate } from '@iuh-exchange/common';
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
  suggestProductsHandler,
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

function canModerateProducts(req, _res, next) {
  if (
    req.user?.role === 'ADMIN' ||
    (req.user?.role === 'MODERATOR' && req.user?.permissions?.includes('CAN_APPROVE_POST'))
  ) {
    return next();
  }
  return next(new ForbiddenException('Product moderation access required'));
}

router.get('/admin/pending', authenticate, canModerateProducts, validateQuery(paginationSchema), asyncHandler(getPendingProducts));
router.get('/admin', authenticate, canModerateProducts, validateQuery(adminProductListSchema), asyncHandler(listAdminProducts));
router.patch('/admin/:id/resolve', authenticate, canModerateProducts, asyncHandler(resolveProduct));
router.delete('/admin/:id', authenticate, canModerateProducts, asyncHandler(deleteProductAsAdmin));
router.get('/admin/stats', authenticate, adminOnly, asyncHandler(getProductStats));

router.get('/search', validateQuery(searchSchema), asyncHandler(searchProductsHandler));
router.get('/suggestions', asyncHandler(suggestProductsHandler));
router.get('/', validateQuery(paginationSchema), asyncHandler(listProducts));

router.get('/me', authenticate, validateQuery(paginationSchema), asyncHandler(getMyProducts));
router.post('/', authenticate, authorize('CAN_POST'), validateBody(createProductSchema), asyncHandler(createProduct));
router.post('/upload-url', authenticate, authorize('CAN_POST'), validateBody(uploadUrlSchema), asyncHandler(getUploadUrl));

router.get('/:id', asyncHandler(getProductById));
router.put('/:id', authenticate, authorize('CAN_POST'), validateBody(createProductSchema), asyncHandler(updateProduct));
router.delete('/:id', authenticate, asyncHandler(deleteProduct));

export default router;
