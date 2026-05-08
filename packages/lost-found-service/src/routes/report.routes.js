import { Router } from 'express';
import { authenticate, authorize } from '@iuh-exchange/common';
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

// Admin only: list & resolve reports
router.get('/admin', authenticate, authorize('admin'), listReports);
router.patch('/admin/:reportId/resolve', authenticate, authorize('admin'), resolveReport);

export default router;
