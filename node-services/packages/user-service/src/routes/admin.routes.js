import { Router } from 'express';
import { authenticate, authorize, ForbiddenException, validate } from '@iuh-exchange/common';
import {
  updateRoleSchema,
  updatePermissionsSchema,
  adjustKarmaSchema,
  banUserSchema,
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

router.get('/users', adminCtrl.listUsers);
router.put('/users/:id/role', validate(updateRoleSchema), adminCtrl.updateUserRole);
router.put('/users/:id/permissions', validate(updatePermissionsSchema), adminCtrl.updateUserPermissions);
router.put('/users/:id/karma', validate(adjustKarmaSchema), adminCtrl.adjustKarma);
router.post('/users/:id/ban', validate(banUserSchema), adminCtrl.banUser);
router.post('/users/:id/unban', adminCtrl.unbanUser);
router.get('/stats', adminCtrl.getUserStats);

export default router;
