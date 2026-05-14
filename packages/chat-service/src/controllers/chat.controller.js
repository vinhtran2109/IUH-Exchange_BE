import { ChatMessage } from '../models/ChatMessage.js';
import {
  ApiResponse,
  BadRequestException,
  ForbiddenException,
  PageResponse,
  parsePagination,
  ResourceNotFoundException,
  logger,
} from '@iuh-exchange/common';

// Bug #6 fix: Escape special regex chars to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/v1/chat/conversations
 * Get paginated list of user's conversations with last message and unread count.
 */
export async function getUserConversations(req, res, next) {
  try {
    const userId = req.user.sub;
    const { page, size, skip } = parsePagination(req.query);

    const pipeline = [
      { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiverId', userId] }, { $eq: ['$isRead', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          content: [{ $skip: skip }, { $limit: size }],
        },
      },
    ];

    const [result] = await ChatMessage.aggregate(pipeline);
    const total = result.metadata[0]?.total || 0;
    const content = result.content;

    const pageResponse = new PageResponse({
      content,
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
 * GET /api/v1/chat/conversations/:conversationId
 * Get paginated message history for a conversation.
 */
export async function getConversationHistory(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { page, size, skip } = parsePagination(req.query);

    // Bug #22 fix: Validate conversationId format (expected: "userId1:userId2")
    if (!conversationId || !/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(conversationId)) {
      return res.status(400).json(ApiResponse.error(400, 'Invalid conversationId format'));
    }

    const [messages, total] = await Promise.all([
      ChatMessage.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean(),
      ChatMessage.countDocuments({ conversationId }),
    ]);

    const pageResponse = new PageResponse({
      content: messages.reverse(),
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
 * PATCH /api/v1/chat/conversations/:conversationId/read
 * Mark all unread messages in a conversation as read for the current user.
 */
export async function markConversationAsRead(req, res, next) {
  try {
    const userId = req.user.sub;
    const { conversationId } = req.params;

    const result = await ChatMessage.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { isRead: true },
    );

    logger.info(`Marked ${result.modifiedCount} messages as read in ${conversationId} for ${userId}`);
    res.json(ApiResponse.ok({ modifiedCount: result.modifiedCount }));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/chat/conversations/read-all
 * Mark all unread messages across all conversations as read for the current user.
 */
export async function markAllConversationsAsRead(req, res, next) {
  try {
    const userId = req.user.sub;

    const result = await ChatMessage.updateMany(
      { receiverId: userId, isRead: false },
      { isRead: true },
    );

    logger.info(`Marked all ${result.modifiedCount} messages as read for ${userId}`);
    res.json(ApiResponse.ok({ modifiedCount: result.modifiedCount }));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/chat/search?q=keyword
 * Search messages for the current user by content keyword.
 */
export async function searchMessages(req, res, next) {
  try {
    const userId = req.user.sub;
    const { q, conversationId } = req.query;
    const { page, size, skip } = parsePagination(req.query);

    if (!q || q.trim().length < 2) {
      return res.json(ApiResponse.ok({ content: [], totalElements: 0 }));
    }

    const filter = {
      $or: [{ senderId: userId }, { receiverId: userId }],
      content: { $regex: escapeRegex(q.trim()), $options: 'i' },
    };

    if (conversationId) {
      filter.conversationId = conversationId;
    }

    const [messages, total] = await Promise.all([
      ChatMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean(),
      ChatMessage.countDocuments(filter),
    ]);

    const pageResponse = new PageResponse({
      content: messages,
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
 * POST /api/v1/chat/messages/:id/report
 * Report an abusive or inappropriate chat message.
 */
export async function reportMessage(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const reason = String(req.body?.reason || '').trim();

    if (!reason || reason.length < 3) {
      throw new BadRequestException('Reason must be at least 3 characters');
    }

    const message = await ChatMessage.findById(id);
    if (!message) throw new ResourceNotFoundException('ChatMessage', id);

    const isParticipant = String(message.senderId) === String(userId) || String(message.receiverId) === String(userId);
    if (!isParticipant) {
      throw new ForbiddenException('You can only report messages from your own conversations');
    }

    message.reports = message.reports || [];
    const alreadyReported = message.reports.some((report) => String(report.reportedBy) === String(userId));
    if (alreadyReported) {
      throw new BadRequestException('You have already reported this message');
    }

    message.reported = true;
    message.moderationStatus = 'PENDING';
    message.reports.push({ reportedBy: userId, reason });
    await message.save();

    logger.warn(`Chat message reported: messageId=${id}, reporter=${userId}`);
    res.json(ApiResponse.ok({
      messageId: id,
      reported: true,
      moderationStatus: message.moderationStatus,
    }, 'Message reported'));
  } catch (err) {
    next(err);
  }
}
