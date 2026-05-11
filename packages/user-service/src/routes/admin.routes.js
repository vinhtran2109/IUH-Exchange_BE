import { Router } from 'express';
import { authenticate, ForbiddenException, validate } from '@iuh-exchange/common';
import {
  updateRoleSchema,
  updatePermissionsSchema,
  adjustKarmaSchema,
} from './admin.schema.js';
import * as adminCtrl from '../controllers/admin.controller.js';
import { getUserKarmaHistory } from '../controllers/karma.controller.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new ForbiddenException('Admin access required'));
  }
  next();
}

// All admin routes require authentication + ADMIN role
router.use(authenticate, requireAdmin);

// GET /api/v1/users/admin/all — list all users (paginated)
// Also available as GET /api/v1/admin/users
router.get('/all', asyncHandler(adminCtrl.listUsers));
router.get('/users', asyncHandler(adminCtrl.listUsers));

// POST /api/v1/users/admin/:id/ban — ban user
router.post('/:id/ban', asyncHandler(adminCtrl.banUser));

// POST /api/v1/users/admin/:id/unban — unban user
router.post('/:id/unban', asyncHandler(adminCtrl.unbanUser));

// PATCH /api/v1/users/admin/:id/toggle-ban — toggle ban status
router.patch('/:id/toggle-ban', asyncHandler(adminCtrl.toggleBanUser));

// Legacy routes (kept for backward compatibility)
router.put('/:id/role', validate(updateRoleSchema), asyncHandler(adminCtrl.updateUserRole));
router.put('/:id/permissions', validate(updatePermissionsSchema), asyncHandler(adminCtrl.updateUserPermissions));
router.put('/:id/karma', validate(adjustKarmaSchema), asyncHandler(adminCtrl.adjustKarma));

// GET /api/v1/users/admin/stats — user statistics
router.get('/stats', asyncHandler(adminCtrl.getUserStats));

// GET /api/v1/users/admin/:id/karma-history — user karma history
router.get('/:id/karma-history', asyncHandler(getUserKarmaHistory));

// GET /api/v1/users/admin/:id/detail — detailed user info
router.get('/:id/detail', asyncHandler(adminCtrl.getUserDetail));

export default router;
