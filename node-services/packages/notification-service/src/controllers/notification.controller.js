import { Notification } from '../models/Notification.js';
import { ApiResponse, PageResponse, parsePagination, logger } from '@iuh-exchange/common';

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

    const result = await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true },
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
