import { KarmaHistory } from '../models/KarmaHistory.js';
import { ApiResponse, PageResponse, parsePagination } from '@iuh-exchange/common';

/**
 * GET /api/v1/users/me/karma-history
 * Get paginated karma history for the authenticated user.
 */
export async function getMyKarmaHistory(req, res) {
  const userId = req.user.sub;
  const { page, size, skip } = parsePagination(req.query);

  const [history, total] = await Promise.all([
    KarmaHistory.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
    KarmaHistory.countDocuments({ userId }),
  ]);

  const pageResponse = new PageResponse({
    content: history,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse));
}

/**
 * GET /api/v1/users/admin/:id/karma-history
 * Get paginated karma history for a specific user (admin only).
 */
export async function getUserKarmaHistory(req, res) {
  const { id } = req.params;
  const { page, size, skip } = parsePagination(req.query);

  const [history, total] = await Promise.all([
    KarmaHistory.find({ userId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
    KarmaHistory.countDocuments({ userId: id }),
  ]);

  const pageResponse = new PageResponse({
    content: history,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse));
}
