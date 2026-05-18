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
import { LostFoundItem } from '../models/LostFound.js';
import { generatePresignedUploadUrl, deleteFileByUrl } from '../services/s3.service.js';
import { findMatches, autoMatchOnCreate } from '../services/matching.service.js';
import { queueAnalysis } from '../services/image-processor.service.js';

// ── Validation Schemas ──

const CATEGORY_ENUM = ['ELECTRONICS', 'ACCESSORIES', 'CLOTHING', 'DOCUMENTS', 'KEYS', 'BAGS', 'OTHER'];

const createItemSchema = z.object({
  type: z.enum(['LOST', 'FOUND']),
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional().default(''),
  images: z.array(z.string().url()).max(10).optional().default([]),
  location: z.string().max(300).optional(),
  contactInfo: z.string().max(200).optional(),
  category: z.enum(CATEGORY_ENUM).optional().default('OTHER'),
  tags: z.array(z.string().max(50).trim().toLowerCase()).max(10).optional().default([]),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  location: z.string().max(300).optional(),
  contactInfo: z.string().max(200).optional(),
  category: z.enum(CATEGORY_ENUM).optional(),
  tags: z.array(z.string().max(50).trim().toLowerCase()).max(10).optional(),
  status: z.enum(['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED']).optional(),
});

const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

// ── Response Mapper ──

function mapItem(item) {
  const obj = item.toObject ? item.toObject() : item;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
    imageUrls: obj.images || [],
    studentId: obj.userId?.toString() || obj.userId,
  };
}

// ── Controllers ──

/**
 * GET /api/v1/lost-found
 * List items with optional type/status filter + pagination.
 */
export async function listItems(req, res, next) {
  try {
    const { page, size, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.type) {
      if (!['LOST', 'FOUND'].includes(req.query.type)) {
        throw new BadRequestException('Invalid type. Must be LOST or FOUND');
      }
      filter.type = req.query.type;
    }
    if (req.query.status) {
      if (!['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED'].includes(req.query.status)) {
        throw new BadRequestException('Invalid status. Must be OPEN, CLAIMED, RESOLVED, or CLOSED');
      }
      filter.status = req.query.status;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.keyword) {
      const keywordRegex = new RegExp(req.query.keyword, 'i');
      filter.$or = [
        { title: keywordRegex },
        { description: keywordRegex },
        { tags: { $in: [req.query.keyword.toLowerCase()] } },
      ];
    }

    const [items, total] = await Promise.all([
      LostFoundItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      LostFoundItem.countDocuments(filter),
    ]);

    const pageData = new PageResponse({
      content: items.map(mapItem),
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
 * GET /api/v1/lost-found/admin
 * Admin list items with optional type/status filter + pagination.
 */
export async function listAdminItems(req, res, next) {
  try {
    const { page, size, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.type && req.query.type !== 'ALL') {
      if (!['LOST', 'FOUND'].includes(req.query.type)) {
        throw new BadRequestException('Invalid type. Must be LOST or FOUND');
      }
      filter.type = req.query.type;
    }

    if (req.query.status && req.query.status !== 'ALL') {
      if (!['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED'].includes(req.query.status)) {
        throw new BadRequestException('Invalid status. Must be OPEN, CLAIMED, RESOLVED, or CLOSED');
      }
      filter.status = req.query.status;
    }

    const [items, total] = await Promise.all([
      LostFoundItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      LostFoundItem.countDocuments(filter),
    ]);

    const pageData = new PageResponse({
      content: items.map(mapItem),
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
 * GET /api/v1/lost-found/:id
 */
export async function getItemById(req, res, next) {
  try {
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);
    res.json(ApiResponse.ok(mapItem(item)));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found
 * Create a new lost/found item. Requires authentication.
 */
export async function createItem(req, res, next) {
  try {
    const rawData = { ...req.body };
    // Support frontend field name: imageUrls → images
    if (rawData.imageUrls && !rawData.images) {
      rawData.images = rawData.imageUrls;
    }
    const data = createItemSchema.parse(rawData);
    const hasImages = data.images && data.images.length > 0;
    const item = await LostFoundItem.create({
      ...data,
      userId: req.user.sub,
      analysisStatus: hasImages ? 'PENDING' : 'SKIPPED',
    });

    logger.info(`LostFoundItem created: ${item._id} by user ${req.user.sub}`);

    // Trigger async image analysis (non-blocking)
    if (hasImages) {
      queueAnalysis(item._id.toString());
    }

    // Auto-match with opposite type items
    const matches = await autoMatchOnCreate(item);

    res.status(201).json(ApiResponse.created({
      ...mapItem(item),
      matches: matches.map((m) => ({
        item: mapItem(m.item),
        score: m.score,
      })),
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/lost-found/:id
 * Update an item. Only the owner can update.
 */
export async function updateItem(req, res, next) {
  try {
    const data = updateItemSchema.parse(req.body);
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    if (item.userId.toString() !== req.user.sub) {
      throw new ForbiddenException('You can only update your own items');
    }

    // Auto-close when resolved
    if (data.status === 'RESOLVED') {
      data.status = 'CLOSED';
    }

    Object.assign(item, data);
    await item.save();

    logger.info(`LostFoundItem updated: ${item._id} by user ${req.user.sub}`);
    res.json(ApiResponse.ok(mapItem(item)));
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/lost-found/:id
 * Delete an item. Only the owner can delete. Cleans up S3 images.
 */
export async function deleteItem(req, res, next) {
  try {
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    if (item.userId.toString() !== req.user.sub) {
      throw new ForbiddenException('You can only delete your own items');
    }

    // Best-effort S3 cleanup
    if (item.images?.length) {
      await Promise.allSettled(item.images.map((url) => deleteFileByUrl(url)));
    }

    await item.deleteOne();
    logger.info(`LostFoundItem deleted: ${req.params.id} by user ${req.user.sub}`);

    res.json(ApiResponse.ok(null, 'Item deleted'));
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/lost-found/admin/:id
 * Admin delete an item regardless of owner. Cleans up S3 images.
 */
export async function deleteItemAsAdmin(req, res, next) {
  try {
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    if (item.images?.length) {
      await Promise.allSettled(item.images.map((url) => deleteFileByUrl(url)));
    }

    await item.deleteOne();
    logger.info(`LostFoundItem deleted by admin: ${req.params.id} by user ${req.user.sub}`);

    res.json(ApiResponse.ok(null, 'Item deleted by admin'));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found/:id/claim
 * Claim an item (set status to CLAIMED). Only non-owners can claim.
 */
export async function claimItem(req, res, next) {
  try {
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    if (item.userId.toString() === req.user.sub) {
      throw new BadRequestException('You cannot claim your own item');
    }

    if (item.status !== 'OPEN') {
      throw new BadRequestException(`Item is not available for claiming (current status: ${item.status})`);
    }

    item.status = 'CLAIMED';
    await item.save();

    logger.info(`LostFoundItem claimed: ${item._id} by user ${req.user.sub}`);
    res.json(ApiResponse.ok(mapItem(item), 'Item claimed successfully'));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found/upload-url
 * Generate presigned S3 URL for image upload.
 */
export async function getUploadUrl(req, res, next) {
  try {
    const { filename, contentType } = uploadUrlSchema.parse(req.body);
    const result = await generatePresignedUploadUrl(filename, contentType);

    res.json(ApiResponse.ok(result));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/lost-found/:id/matches
 * Find matching items (LOST ↔ FOUND) for a given item.
 * Query params: limit (default 10), minScore (default 0.15)
 */
export async function getMatches(req, res, next) {
  try {
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const minScore = parseFloat(req.query.minScore) || 0.15;

    const matches = await findMatches(req.params.id, { limit, minScore });

    res.json(
      ApiResponse.ok({
        sourceItem: mapItem(item),
        matches: matches.map((m) => ({
          item: mapItem(m.item),
          score: m.score,
        })),
        totalMatches: matches.length,
      }),
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found/match-preview
 * Preview matches for a LOST/FOUND item before actually creating it.
 * Useful for the frontend to show "potential matches" as the user fills in the form.
 */
export async function previewMatches(req, res, next) {
  try {
    const rawData = { ...req.body };
    if (rawData.imageUrls && !rawData.images) {
      rawData.images = rawData.imageUrls;
    }
    const data = createItemSchema.parse(rawData);

    const targetType = data.type === 'LOST' ? 'FOUND' : 'LOST';
    const filter = {
      type: targetType,
      status: 'OPEN',
    };

    if (data.category && data.category !== 'OTHER') {
      filter.$or = [{ category: data.category }, { category: 'OTHER' }];
    }

    const candidates = await LostFoundItem.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    const scored = [];
    for (const candidate of candidates) {
      const score = calculateMatchScoreFromData(data, candidate);
      if (score >= 0.15) {
        scored.push({ item: candidate, score: Math.round(score * 1000) / 1000 });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 10);

    res.json(
      ApiResponse.ok({
        matches: topMatches.map((m) => ({
          item: mapItem(m.item),
          score: m.score,
        })),
        totalMatches: topMatches.length,
      }),
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Helper: calculate match score using raw data (not saved item).
 * Used for preview matches before creation.
 */
function calculateMatchScoreFromData(data, candidate) {
  let score = 0;
  let weights = 0;

  // Normalize helper
  const normalize = (t) =>
    (t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const extractKw = (t) =>
    normalize(t)
      .split(' ')
      .filter((w) => w.length >= 2);

  const jaccard = (a, b) => {
    if (a.size === 0 && b.size === 0) return 0;
    const inter = new Set([...a].filter((x) => b.has(x)));
    const uni = new Set([...a, ...b]);
    return inter.size / uni.size;
  };

  // Title (35)
  const srcTitle = new Set(extractKw(data.title));
  const candTitle = new Set(extractKw(candidate.title));
  score += jaccard(srcTitle, candTitle) * 35;
  weights += 35;

  // Description (25)
  const srcDesc = new Set(extractKw(data.description || ''));
  const candDesc = new Set(extractKw(candidate.description || ''));
  score += jaccard(srcDesc, candDesc) * 25;
  weights += 25;

  // Category (20)
  if (data.category && candidate.category) {
    if (data.category === candidate.category) score += 20;
    weights += 20;
  }

  // Tags (15)
  if (data.tags?.length && candidate.tags?.length) {
    const srcTags = new Set(data.tags.map(normalize));
    const candTags = new Set(candidate.tags.map(normalize));
    score += jaccard(srcTags, candTags) * 15;
    weights += 15;
  }

  // Location (5)
  const srcLoc = new Set(normalize(data.location).split(' '));
  const candLoc = new Set(normalize(candidate.location).split(' '));
  score += jaccard(srcLoc, candLoc) * 5;
  weights += 5;

  return weights > 0 ? score / weights : 0;
}
