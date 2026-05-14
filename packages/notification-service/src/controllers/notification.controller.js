import { Notification } from '../models/Notification.js';
import { ApiResponse, PageResponse, parsePagination, logger, ForbiddenException } from '@iuh-exchange/common';
import { sendAdminComposedEmail } from '../services/email.service.js';

/**
 * GET /api/v1/notifications
 * Get paginated notifications for the authenticated user, optionally filtered by type.
 */
export async function getNotifications(req, res, next) {
  try {
    const userId = req.user.sub;
    const { page, size, skip } = parsePagination(req.query);
    const { type } = req.query;

    const filter = { recipientId: userId };
    if (type) {
      const validTypes = ['ORDER', 'CHAT', 'SYSTEM', 'KARMA', 'REPORT'];
      if (!validTypes.includes(type)) {
        return res.status(400).json(ApiResponse.error(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`));
      }
      filter.type = type;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
      Notification.countDocuments(filter),
    ]);

    const pageResponse = new PageResponse({
      content: notifications,
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    });

    res.json(ApiResponse.ok(pageResponse));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/notifications/unread-count
 * Get count of unread notifications for the authenticated user.
 */
export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.sub;
    const count = await Notification.countDocuments({ recipientId: userId, isRead: false });
    res.json(ApiResponse.ok({ count }));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read.
 */
export async function markAsRead(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json(ApiResponse.error(404, 'Notification not found'));
    }

    res.json(ApiResponse.ok(notification));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.sub;

    // Bug #35 fix: Add batch size limit to prevent excessive DB writes
    const MAX_BATCH = 1000;
    const result = await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true },
      { limit: MAX_BATCH },
    );

    logger.info(`Marked all ${result.modifiedCount} notifications as read for ${userId}`);
    res.json(ApiResponse.ok({ modifiedCount: result.modifiedCount }));
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/notifications/:id
 * Delete a single notification.
 */
export async function deleteNotification(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({ _id: id, recipientId: userId });

    if (!notification) {
      return res.status(404).json(ApiResponse.error(404, 'Notification not found'));
    }

    res.json(ApiResponse.ok(null, 'Notification deleted'));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/notifications/admin/email/compose
 * Send a manually composed email from the admin console.
 */
export async function composeAdminEmail(req, res, next) {
  try {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const { to, subject, body } = req.body || {};
    const recipients = Array.isArray(to)
      ? to.map((email) => String(email).trim()).filter(Boolean)
      : String(to || '')
        .split(/[,\n;]/)
        .map((email) => email.trim())
        .filter(Boolean);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (recipients.length === 0 || recipients.length > 50 || recipients.some((email) => !emailPattern.test(email))) {
      return res.status(400).json(ApiResponse.error(400, 'Danh sách email không hợp lệ hoặc vượt quá 50 người nhận'));
    }

    if (!subject || String(subject).trim().length < 3 || String(subject).length > 160) {
      return res.status(400).json(ApiResponse.error(400, 'Tiêu đề email phải từ 3 đến 160 ký tự'));
    }

    if (!body || String(body).trim().length < 5 || String(body).length > 5000) {
      return res.status(400).json(ApiResponse.error(400, 'Nội dung email phải từ 5 đến 5000 ký tự'));
    }

    const result = await sendAdminComposedEmail({
      to: recipients,
      subject: String(subject).trim(),
      body: String(body).trim(),
      senderName: req.user.email || req.user.sub,
    });

    res.json(ApiResponse.ok({ ...result, recipients: recipients.length }, 'Email đã được gửi'));
  } catch (err) {
    next(err);
  }
}
