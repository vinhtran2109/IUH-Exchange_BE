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

function requireAdminOrModerator(req, _res, next) {
  if (!req.user || !['ADMIN', 'MODERATOR'].includes(req.user.role)) {
    return next(new ForbiddenException('Moderator access required'));
  }
  next();
}

function requireBanPermission(req, _res, next) {
  if (req.user?.role === 'ADMIN' || req.user?.permissions?.includes('CAN_BAN')) {
    return next();
  }
  return next(new ForbiddenException('CAN_BAN permission required'));
}

router.use(authenticate);

router.get('/all', requireAdminOrModerator, asyncHandler(adminCtrl.listUsers));
router.get('/users', requireAdminOrModerator, asyncHandler(adminCtrl.listUsers));
router.get('/audit-logs', requireAdmin, asyncHandler(adminCtrl.listAuditLogs));

router.post('/:id/ban', requireAdminOrModerator, requireBanPermission, asyncHandler(adminCtrl.banUser));
router.post('/:id/unban', requireAdminOrModerator, requireBanPermission, asyncHandler(adminCtrl.unbanUser));
router.patch('/:id/toggle-ban', requireAdminOrModerator, requireBanPermission, asyncHandler(adminCtrl.toggleBanUser));

router.put('/:id/role', requireAdmin, validate(updateRoleSchema), asyncHandler(adminCtrl.updateUserRole));
router.put('/:id/permissions', requireAdmin, validate(updatePermissionsSchema), asyncHandler(adminCtrl.updateUserPermissions));
router.put('/:id/karma', requireAdmin, validate(adjustKarmaSchema), asyncHandler(adminCtrl.adjustKarma));
router.patch('/:id/student-verification', requireAdmin, asyncHandler(adminCtrl.reviewStudentVerification));

router.get('/stats', requireAdmin, asyncHandler(adminCtrl.getUserStats));
router.get('/:id/karma-history', requireAdmin, asyncHandler(getUserKarmaHistory));
router.get('/:id/detail', requireAdminOrModerator, asyncHandler(adminCtrl.getUserDetail));
router.delete('/:id', requireAdmin, asyncHandler(adminCtrl.deleteUserAccount));

export default router;
