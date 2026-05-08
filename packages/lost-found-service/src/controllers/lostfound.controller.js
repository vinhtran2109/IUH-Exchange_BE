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

// ── Validation Schemas ──

const createItemSchema = z.object({
  type: z.enum(['LOST', 'FOUND']),
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional().default(''),
  images: z.array(z.string().url()).max(10).optional().default([]),
  location: z.string().max(300).optional(),
  contactInfo: z.string().max(200).optional(),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  location: z.string().max(300).optional(),
  contactInfo: z.string().max(200).optional(),
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
    const item = await LostFoundItem.create({
      ...data,
      userId: req.user.sub,
    });

    logger.info(`LostFoundItem created: ${item._id} by user ${req.user.sub}`);
    res.status(201).json(ApiResponse.created(mapItem(item)));
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
