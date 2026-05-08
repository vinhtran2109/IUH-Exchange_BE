import { Router } from 'express';
import { authenticate, ForbiddenException, validate } from '@iuh-exchange/common';
import {
  updateRoleSchema,
  updatePermissionsSchema,
  adjustKarmaSchema,
} from './admin.schema.js';
import * as adminCtrl from '../controllers/admin.controller.js';

const router = Router();

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
  next();
}

// All admin routes require authentication + ADMIN role
router.use(authenticate, requireAdmin);

// GET /api/v1/users/admin/all — list all users (paginated)
router.get('/all', adminCtrl.listUsers);

// PATCH /api/v1/users/admin/:id/toggle-ban — toggle ban status
router.patch('/:id/toggle-ban', adminCtrl.toggleBanUser);

// Legacy routes (kept for backward compatibility)
router.put('/:id/role', validate(updateRoleSchema), adminCtrl.updateUserRole);
router.put('/:id/permissions', validate(updatePermissionsSchema), adminCtrl.updateUserPermissions);
router.put('/:id/karma', validate(adjustKarmaSchema), adminCtrl.adjustKarma);

// GET /api/v1/users/admin/stats — user statistics
router.get('/stats', adminCtrl.getUserStats);

export default router;
