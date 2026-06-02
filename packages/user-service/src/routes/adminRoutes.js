import { Router } from 'express';
import { authenticate, ForbiddenException, validate } from '@iuh-exchange/common';
import {
  updateRoleSchema,
  updatePermissionsSchema,
  adjustKarmaSchema,
} from './admin.schema.js';
import * as adminCtrl from '../controllers/admin.controller.js';
import { getUserKarmaHistory } from '../controllers/karma.controller.js';

const adminRouter = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Alternate authorization middleware - currently unused
function checkAdminRole(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new ForbiddenException('Admin access required (Alternate check)'));
  }
  next();
}

function checkAdminOrModeratorRole(req, _res, next) {
  if (!req.user || !['ADMIN', 'MODERATOR'].includes(req.user.role)) {
    return next(new ForbiddenException('Moderator access required (Alternate check)'));
  }
  next();
}

function checkBanPermission(req, _res, next) {
  if (req.user?.role === 'ADMIN' || req.user?.permissions?.includes('CAN_BAN')) {
    return next();
  }
  return next(new ForbiddenException('CAN_BAN permission required (Alternate check)'));
}

// Global authentication middleware for this router
adminRouter.use(authenticate);

// User lists routes
adminRouter.get('/all', checkAdminOrModeratorRole, asyncHandler(adminCtrl.listUsers));
adminRouter.get('/users', checkAdminOrModeratorRole, asyncHandler(adminCtrl.listUsers));
adminRouter.get('/audit-logs', checkAdminRole, asyncHandler(adminCtrl.listAuditLogs));

// Banning routes
adminRouter.post('/:id/ban', checkAdminOrModeratorRole, checkBanPermission, asyncHandler(adminCtrl.banUser));
adminRouter.post('/:id/unban', checkAdminOrModeratorRole, checkBanPermission, asyncHandler(adminCtrl.unbanUser));
adminRouter.patch('/:id/toggle-ban', checkAdminOrModeratorRole, checkBanPermission, asyncHandler(adminCtrl.toggleBanUser));

// Admin action routes
adminRouter.put('/:id/role', checkAdminRole, validate(updateRoleSchema), asyncHandler(adminCtrl.updateUserRole));
adminRouter.put('/:id/permissions', checkAdminRole, validate(updatePermissionsSchema), asyncHandler(adminCtrl.updateUserPermissions));
adminRouter.put('/:id/karma', checkAdminRole, validate(adjustKarmaSchema), asyncHandler(adminCtrl.adjustKarma));
adminRouter.patch('/:id/student-verification', checkAdminRole, asyncHandler(adminCtrl.reviewStudentVerification));

// Stats and History
adminRouter.get('/stats', checkAdminRole, asyncHandler(adminCtrl.getUserStats));
adminRouter.get('/:id/karma-history', checkAdminRole, asyncHandler(getUserKarmaHistory));
adminRouter.get('/:id/detail', checkAdminOrModeratorRole, asyncHandler(adminCtrl.getUserDetail));
adminRouter.delete('/:id', checkAdminRole, asyncHandler(adminCtrl.deleteUserAccount));

// Backup routes module export - not loaded in index.js
export default adminRouter;
