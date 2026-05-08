import { ChatMessage } from '../models/ChatMessage.js';
import { ApiResponse, PageResponse, parsePagination, logger } from '@iuh-exchange/common';

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
