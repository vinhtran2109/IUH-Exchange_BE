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

router.use(authenticate, requireAdmin);

router.get('/all', asyncHandler(adminCtrl.listUsers));
router.get('/users', asyncHandler(adminCtrl.listUsers));
router.get('/audit-logs', asyncHandler(adminCtrl.listAuditLogs));

router.post('/:id/ban', asyncHandler(adminCtrl.banUser));
router.post('/:id/unban', asyncHandler(adminCtrl.unbanUser));
router.patch('/:id/toggle-ban', asyncHandler(adminCtrl.toggleBanUser));

router.put('/:id/role', validate(updateRoleSchema), asyncHandler(adminCtrl.updateUserRole));
router.put('/:id/permissions', validate(updatePermissionsSchema), asyncHandler(adminCtrl.updateUserPermissions));
router.put('/:id/karma', validate(adjustKarmaSchema), asyncHandler(adminCtrl.adjustKarma));

router.get('/stats', asyncHandler(adminCtrl.getUserStats));
router.get('/:id/karma-history', asyncHandler(getUserKarmaHistory));
router.get('/:id/detail', asyncHandler(adminCtrl.getUserDetail));
router.delete('/:id', asyncHandler(adminCtrl.deleteUserAccount));

export default router;
