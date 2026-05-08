import { Router } from 'express';
import { authenticate, ForbiddenException } from '@iuh-exchange/common';
import {
  createReport,
  listReports,
  resolveReport,
  listMyReports,
} from '../controllers/report.controller.js';

const router = Router();

// Authenticated: submit a report
router.post('/', authenticate, createReport);

// Authenticated: view own reports
router.get('/my', authenticate, listMyReports);

function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    throw new ForbiddenException('Admin access required');
  }
  next();
}

// Admin only: list & resolve reports
router.get('/admin', authenticate, adminOnly, listReports);
router.patch('/admin/:reportId/resolve', authenticate, adminOnly, resolveReport);

export default router;
