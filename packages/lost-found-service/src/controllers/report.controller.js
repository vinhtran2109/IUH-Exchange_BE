import { z } from 'zod';
import {
  ApiResponse,
  PageResponse,
  ResourceNotFoundException,
  ForbiddenException,
  BadRequestException,
  parsePagination,
  logger,
} from '@iuh-exchange/common';
import { Report } from '../models/LostFound.js';
import { publishKarmaPenalty } from '../services/kafka.service.js';

// ── Validation Schemas ──

const createReportSchema = z.object({
  targetType: z.enum(['USER', 'PRODUCT', 'LOST_FOUND']),
  targetId: z.string().min(1),
  reason: z.string().min(5).max(1000).trim(),
});

const ACCOUNT_SUPPORT_PREFIX = '[Hỗ trợ tài khoản]';

const isAccountSupportReport = (reportLike) =>
  reportLike?.targetType === 'USER' &&
  String(reportLike?.targetId) === String(reportLike?.reporterId || '') &&
  typeof reportLike?.reason === 'string' &&
  reportLike.reason.startsWith(ACCOUNT_SUPPORT_PREFIX);

const resolveReportSchema = z.object({
  status: z.enum(['REVIEWED', 'RESOLVED', 'DISMISSED']),
  adminNote: z.string().max(2000).optional().default(''),
});

// ── Controllers ──

/**
 * POST /api/v1/reports
 * Submit a new report. Requires authentication.
 */
export async function createReport(req, res, next) {
  try {
    const data = createReportSchema.parse(req.body);

    const isAccountSupport = data.targetType === 'USER' && data.targetId === req.user.sub && data.reason.startsWith(ACCOUNT_SUPPORT_PREFIX);

    // Prevent self-reporting, except account support tickets.
    if (data.targetType === 'USER' && data.targetId === req.user.sub && !isAccountSupport) {
      throw new BadRequestException('You cannot report yourself');
    }

    // Prevent duplicate reports from same user on same target within 24h
    const recentDuplicate = await Report.findOne({
      reporterId: req.user.sub,
      targetType: data.targetType,
      targetId: data.targetId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (recentDuplicate) {
      throw new BadRequestException('You have already reported this target in the last 24 hours');
    }

    const report = await Report.create({
      ...data,
      reporterId: req.user.sub,
    });

    logger.info(`Report created: ${report._id} by user ${req.user.sub} against ${data.targetType}:${data.targetId}`);
    res.status(201).json(ApiResponse.created(report));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/admin
 * List reports (admin only). Filter by status.
 */
export async function listReports(req, res, next) {
  try {
    const { page, size, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.status) {
      if (!['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'].includes(req.query.status)) {
        throw new BadRequestException('Invalid report status');
      }
      filter.status = req.query.status;
    }

    if (req.query.targetType) {
      filter.targetType = req.query.targetType;
    }

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      Report.countDocuments(filter),
    ]);

    const pageData = new PageResponse({
      content: reports,
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    });

    res.json(ApiResponse.ok(pageData));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/reports/admin/:reportId/resolve
 * Admin resolves a report. If approved, publishes karma penalty event.
 */
export async function resolveReport(req, res, next) {
  try {
    // Frontend sends status & adminNote as query params
    let statusRaw = req.query.status || req.body?.status;
    // Map frontend status values to backend enum
    if (statusRaw === 'APPROVED') statusRaw = 'RESOLVED';

    const data = resolveReportSchema.parse({
      status: statusRaw,
      adminNote: req.query.adminNote || req.body?.adminNote || '',
    });
    const skipKarmaPenalty = req.query.skipKarmaPenalty === 'true' || req.body?.skipKarmaPenalty === true;

    const report = await Report.findById(req.params.reportId);
    if (!report) throw new ResourceNotFoundException('Report', req.params.reportId);

    if (['RESOLVED', 'DISMISSED'].includes(report.status)) {
      throw new BadRequestException(`Report is already ${report.status.toLowerCase()}`);
    }

    report.status = data.status;
    report.adminNote = data.adminNote;
    await report.save();

    // If admin approves the report (complaint is valid), deduct karma from reported user
    if (data.status === 'RESOLVED' && report.targetType === 'USER' && !skipKarmaPenalty && !isAccountSupportReport(report)) {
      await publishKarmaPenalty(report.targetId.toString(), report.reason);
      logger.info(`Karma penalty triggered for user ${report.targetId} from report ${report._id}`);
    }

    logger.info(`Report ${report._id} resolved as ${data.status} by admin`);
    res.json(ApiResponse.ok(report));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/reports/my
 * List reports submitted by the current user.
 */
export async function listMyReports(req, res, next) {
  try {
    const { page, size, skip } = parsePagination(req.query);

    const filter = { reporterId: req.user.sub };

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      Report.countDocuments(filter),
    ]);

    const pageData = new PageResponse({
      content: reports,
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    });

    res.json(ApiResponse.ok(pageData));
  } catch (err) {
    next(err);
  }
}
