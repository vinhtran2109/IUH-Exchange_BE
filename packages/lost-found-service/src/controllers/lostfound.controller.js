import { z } from 'zod';
import {
  ApiResponse,
  PageResponse,
  ResourceNotFoundException,
  ForbiddenException,
  BadRequestException,
  parsePagination,
  logger,
  cache,
} from '@iuh-exchange/common';
import { LostFoundItem } from '../models/LostFound.js';
import { ConsentLog } from '../models/ConsentLog.js';
import { generatePresignedUploadUrl, deleteFileByUrl } from '../services/s3.service.js';
import { findMatches, autoMatchOnCreate, calculateMatchScore } from '../services/matching.service.js';
import { publishLostFoundMatch } from '../services/kafka.service.js';
import { queueAnalysis } from '../services/image-processor.service.js';
import { publishLostFoundEvent } from '../services/kafka.service.js';
import { generateLostFoundAutoPost } from '../services/ai-autopost.service.js';


// ── Cache Helpers ──────────────────────────────────────────
// Tập trung logic eviction để tránh bỏ sót ở bất kỳ write operation nào.

/**
 * Xoá cache toàn bộ danh sách lost-found.
 * Phải gọi sau mỗi thao tác tạo/cập nhật/xoá item.
 */
async function evictListCache() {
  await cache.delPattern('lostfound:list:*');
}

/**
 * Xoá cache chi tiết 1 item cụ thể.
 * Phải gọi sau khi update/delete item hoặc sau khi AI phân tích xong.
 */
async function evictItemCache(itemId) {
  await cache.del(`lostfound:detail:${itemId}`);
}

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
  verificationQuestion: z.string().max(300).optional().default(''),
  // Consent flags for AI analysis
  consentImageAnalysis: z.boolean().optional().default(false),
  consentMssvExtraction: z.boolean().optional().default(false),
});

const aiAutoPostSchema = z.object({
  type: z.enum(['LOST', 'FOUND']).optional(),
  title: z.string().min(1).max(200).trim(),
  images: z.array(z.string().url()).max(10).optional().default([]),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  location: z.string().min(1).max(300).trim(),
  contactInfo: z.string().max(200).optional(),
  consentImageAnalysis: z.boolean().optional().default(false),
  consentMssvExtraction: z.boolean().optional().default(false),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  location: z.string().max(300).optional(),
  contactInfo: z.string().max(200).optional(),
  category: z.enum(CATEGORY_ENUM).optional(),
  tags: z.array(z.string().max(50).trim().toLowerCase()).max(10).optional(),
  verificationQuestion: z.string().max(300).optional(),
  status: z.enum(['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED']).optional(),
});

const claimSchema = z.object({
  answer: z.string().min(2).max(1000).trim(),
  evidenceUrls: z.array(z.string().url()).max(5).optional().default([]),
});

const reviewClaimSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  ownerNote: z.string().max(1000).optional().default(''),
});

const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

// ── Response Mapper ──

function mapItem(item, userProfile = null) {
  const obj = item.toObject ? item.toObject() : item;
  const userId = obj.userId?.toString() || obj.userId;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
    imageUrls: obj.images || [],
    studentId: userProfile?.studentId || userId,
    userId: userId,
    userName: userProfile?.name || '',
    claims: obj.claims || [],
  };
}

/**
 * Lấy thông tin user từ user-service để hiển thị MSSV thật.
 */
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const userCache = new Map(); // simple in-memory cache
const USER_CACHE_TTL = 60_000; // 1 phút

async function fetchUserProfile(userId) {
  if (!userId) return null;
  const uid = userId.toString();
  const cached = userCache.get(uid);
  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${USER_SERVICE_URL}/api/v1/users/${uid}`);
    if (!res.ok) return null;
    const json = await res.json();
    const user = json?.data;
    if (!user) return null;
    const profile = { name: user.name || '', studentId: user.studentId || '' };
    userCache.set(uid, { data: profile, ts: Date.now() });
    return profile;
  } catch {
    return null;
  }
}

/**
 * Batch lấy nhiều user profiles song song.
 */
async function fetchUserProfiles(userIds) {
  const unique = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];
  const results = await Promise.all(unique.map((id) => fetchUserProfile(id)));
  const map = {};
  unique.forEach((id, i) => { map[id] = results[i]; });
  return map;
}

// ── Controllers ──

/**
 * GET /api/v1/lost-found
 * List items with optional type/status filter + pagination.
 */
export async function listItems(req, res, next) {
  try {
    const { page, size, skip } = parsePagination(req.query);
    const { type, status, category, keyword } = req.query;

    // BUG FIX #1: Cache key PHẢI bao gồm tất cả query params.
    // Thiếu bất kỳ param nào → 2 request khác nhau dùng chung cache key
    // → người dùng A thấy kết quả lọc của người dùng B (data leak tiềm ẩn).
    const cacheKey = [
      'lostfound:list',
      `p${page}`, `s${size}`,
      `type:${type || 'all'}`,
      `status:${status || 'all'}`,
      `cat:${category || 'all'}`,
      `kw:${keyword || ''}`,
    ].join(':');

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug(`[Cache HIT] ${cacheKey}`);
      return res.json(cached);
    }

    const filter = {};

    if (type) {
      if (!['LOST', 'FOUND'].includes(type)) {
        throw new BadRequestException('Invalid type. Must be LOST or FOUND');
      }
      filter.type = type;
    }
    if (status) {
      if (!['OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED'].includes(status)) {
        throw new BadRequestException('Invalid status. Must be OPEN, CLAIMED, RESOLVED, or CLOSED');
      }
      filter.status = status;
    }
    if (category) {
      filter.category = category;
    }
    if (keyword) {
      // BUG FIX #3: Escape special regex characters trước khi tạo RegExp.
      // Không escape → user có thể gửi keyword="(a+)+$" gây ReDoS (CPU 100%),
      // hoặc keyword=".*" để match tất cả items, bất kể filter.
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keywordRegex = new RegExp(escapedKeyword, 'i');
      filter.$or = [
        { title: keywordRegex },
        { description: keywordRegex },
        { tags: { $in: [keyword.toLowerCase()] } },
      ];
    }

    const [items, total] = await Promise.all([
      LostFoundItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size),
      LostFoundItem.countDocuments(filter),
    ]);

    // Lấy thông tin user để hiển thị MSSV thật
    const userIds = items.map((it) => it.userId?.toString());
    const profiles = await fetchUserProfiles(userIds);

    const pageData = new PageResponse({
      content: items.map((it) => mapItem(it, profiles[it.userId?.toString()])),
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      last: page * size >= total,
    });

    const response = ApiResponse.ok(pageData);
    await cache.set(cacheKey, response, 120); // TTL: 2 phút
    res.json(response);
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

    // Lấy thông tin user để hiển thị MSSV thật
    const userIds = items.map((it) => it.userId?.toString());
    const profiles = await fetchUserProfiles(userIds);

    const pageData = new PageResponse({
      content: items.map((it) => mapItem(it, profiles[it.userId?.toString()])),
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
    const cacheKey = `lostfound:detail:${req.params.id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug(`[Cache HIT] ${cacheKey}`);
      return res.json(cached);
    }

    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    const profile = await fetchUserProfile(item.userId?.toString());
    const response = ApiResponse.ok(mapItem(item, profile));
    // TTL 5 phút — analyzeItem() sẽ evict key này sau khi AI phân tích xong (BUG FIX #8)
    await cache.set(cacheKey, response, 300);
    res.json(response);
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

    // Log consent if granted
    if (data.consentImageAnalysis || data.consentMssvExtraction) {
      const consentEntries = [];
      if (data.consentImageAnalysis) {
        consentEntries.push({
          userId: req.user.sub,
          itemId: item._id,
          consentType: 'IMAGE_ANALYSIS',
          granted: true,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });
      }
      if (data.consentMssvExtraction) {
        consentEntries.push({
          userId: req.user.sub,
          itemId: item._id,
          consentType: 'MSSV_EXTRACTION',
          granted: true,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });
      }
      ConsentLog.insertMany(consentEntries).catch((err) =>
        logger.warn(`Failed to log consent: ${err.message}`),
      );
    }

    // BUG FIX #7 — GHI CHÚ RACE CONDITION (trade-off đã chấp nhận):
    // queueAnalysis chạy bất đồng bộ (fire-and-forget), KHÔNG block response.
    // autoMatchOnCreate chạy đồng bộ với dữ liệu HIỆN TẠI (category/tags chưa do AI cập nhật)
    // → Kết quả match trả về lần đầu có thể kém chính xác hơn.
    // SAU KHI AI phân tích xong, analyzeItem() sẽ publish Kafka 'lostfound.match'
    // → notification-service gửi thông báo match chính xác hơn cho người dùng.
    if (hasImages && data.consentImageAnalysis) {
      queueAnalysis(item._id.toString()); // non-blocking
    }

    // Chạy matching với data hiện tại (trước khi AI cập nhật)
    const matches = await autoMatchOnCreate(item);

    // Publish Kafka event để notification-service gửi thông báo match
    if (matches.length > 0) {
      await publishLostFoundMatch({
        itemId: item._id.toString(),
        userId: item.userId.toString(),
        type: item.type,
        title: item.title,
        matches: matches.map((m) => ({
          itemId: m.item._id.toString(),
          title: m.item.title,
          score: m.score,
          ownerId: m.item.userId.toString(),
        })),
      });
    }

    // Evict cache danh sách vì có item mới
    await evictListCache();

    const allUserIds = [item.userId?.toString(), ...matches.map((m) => m.item.userId?.toString())];
    const profiles = await fetchUserProfiles(allUserIds);
    const profile = profiles[item.userId?.toString()];

    res.status(201).json(ApiResponse.created({
      ...mapItem(item, profile),
      matches: matches.map((m) => ({
        item: mapItem(m.item, profiles[m.item.userId?.toString()]),
        score: m.score,
      })),
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found/ai-post
 * Create a lost/found item from minimal user input.
 * Body: { type?, title, location, images|imageUrls, contactInfo?, consentImageAnalysis }
 */
export async function createAiAutoPost(req, res, next) {
  try {
    const rawData = { ...req.body };
    if (rawData.imageUrls && !rawData.images) {
      rawData.images = rawData.imageUrls;
    }

    const input = aiAutoPostSchema.parse(rawData);
    const hasImages = input.images && input.images.length > 0;
    if (hasImages && !input.consentImageAnalysis) {
      throw new BadRequestException('Bạn cần đồng ý cho AI phân tích hình ảnh trước khi tự động đăng bài.');
    }

    const generated = await generateLostFoundAutoPost({
      type: input.type,
      title: input.title,
      location: input.location,
      images: input.images,
    });

    req.body = {
      ...generated,
      contactInfo: input.contactInfo,
      consentImageAnalysis: input.consentImageAnalysis,
      consentMssvExtraction: input.consentMssvExtraction,
    };

    return createItem(req, res, next);
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
    const rawData = { ...req.body };
    if (rawData.imageUrls && !rawData.images) {
      rawData.images = rawData.imageUrls;
    }
    const data = updateItemSchema.parse(rawData);
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

    const shouldReanalyze = Array.isArray(data.images);
    if (shouldReanalyze) {
      item.analysisStatus = item.images?.length ? 'PENDING' : 'SKIPPED';
      item.detectedType = '';
      item.analysisConfidence = 0;
      item.extracted = { studentId: '', text: '' };
      item.analysisMetadata = {};
    }

    await item.save();

    // BUG FIX #2: Evict cả danh sách và detail sau khi cập nhật
    await Promise.all([evictListCache(), evictItemCache(item._id.toString())]);

    if (shouldReanalyze && item.images?.length) {
      queueAnalysis(item._id.toString(), { force: true });
    }

    logger.info(`LostFoundItem updated: ${item._id} by user ${req.user.sub}`);
    const profile = await fetchUserProfile(item.userId?.toString());
    res.json(ApiResponse.ok(mapItem(item, profile)));
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

    // BUG FIX #2: Evict cache sau khi xoá
    await Promise.all([evictListCache(), evictItemCache(req.params.id)]);

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

    // BUG FIX #2: Evict cache sau khi admin xoá
    await Promise.all([evictListCache(), evictItemCache(req.params.id)]);

    logger.info(`LostFoundItem deleted by admin: ${req.params.id} by user ${req.user.sub}`);
    res.json(ApiResponse.ok(null, 'Item deleted by admin'));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found/:id/claim
 * Claim an item. The owner reviews the verification answer before approval.
 */
export async function claimItem(req, res, next) {
  try {
    const data = claimSchema.parse(req.body || {});
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);

    if (item.userId.toString() === req.user.sub) {
      throw new BadRequestException('You cannot claim your own item');
    }

    if (item.status !== 'OPEN') {
      throw new BadRequestException(`Item is not available for claiming (current status: ${item.status})`);
    }

    const existingPending = (item.claims || []).find(
      (claim) => claim.claimantId.toString() === req.user.sub && claim.status === 'PENDING'
    );
    if (existingPending) throw new BadRequestException('You already have a pending claim for this item');

    item.claims = item.claims || [];
    item.claims.push({
      claimantId: req.user.sub,
      answer: data.answer,
      evidenceUrls: data.evidenceUrls,
      status: 'PENDING',
    });
    await item.save();

    // BUG FIX #5: Evict item detail cache vì claims array đã thay đổi
    await evictItemCache(item._id.toString());

    const claim = item.claims[item.claims.length - 1];
    await publishLostFoundEvent('lostfound.claim.created', {
      id: claim._id?.toString(),
      claimId: claim._id?.toString(),
      itemId: item._id.toString(),
      ownerId: item.userId.toString(),
      claimantId: req.user.sub,
      title: item.title,
    });

    logger.info(`LostFoundItem claimed: ${item._id} by user ${req.user.sub}`);
    const profile = await fetchUserProfile(item.userId?.toString());
    res.status(201).json(ApiResponse.created(mapItem(item, profile), 'Claim submitted for owner verification'));
  } catch (err) {
    next(err);
  }
}

export async function reviewClaim(req, res, next) {
  try {
    const data = reviewClaimSchema.parse(req.body || {});
    const item = await LostFoundItem.findById(req.params.id);
    if (!item) throw new ResourceNotFoundException('LostFoundItem', req.params.id);
    if (item.userId.toString() !== req.user.sub) {
      throw new ForbiddenException('Only the item owner can review claims');
    }

    // BUG FIX #4: Mongoose đảm bảo .id() luôn tồn tại trên subdoc array.
    // Không dùng optional chaining ?.() vì có thể silent fail thành undefined
    // thay vì thực sự tìm theo _id như Mongoose quy định.
    const claim = item.claims.id(req.params.claimId)
      || item.claims.find((entry) => entry._id.toString() === req.params.claimId);
    if (!claim) throw new ResourceNotFoundException('LostFoundClaim', req.params.claimId);
    if (claim.status !== 'PENDING') throw new BadRequestException(`Claim is already ${claim.status.toLowerCase()}`);

    claim.status = data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    claim.ownerNote = data.ownerNote;
    claim.reviewedAt = new Date();

    if (claim.status === 'APPROVED') {
      item.status = 'CLAIMED';
      item.approvedClaimId = claim._id;
      for (const other of item.claims) {
        if (other._id.toString() !== claim._id.toString() && other.status === 'PENDING') {
          other.status = 'REJECTED';
          other.ownerNote = 'Another claim was approved';
          other.reviewedAt = new Date();
        }
      }
    }

    await item.save();

    // BUG FIX #5: Evict item detail cache vì status + claims đã thay đổi
    await Promise.all([evictListCache(), evictItemCache(item._id.toString())]);

    // Publish event cho claim chính vừa được xét duyệt
    await publishLostFoundEvent('lostfound.claim.resolved', {
      id: claim._id?.toString(),
      claimId: claim._id?.toString(),
      itemId: item._id.toString(),
      ownerId: item.userId.toString(),
      claimantId: claim.claimantId?.toString(),
      status: claim.status,
      title: item.title,
    });

    // BUG FIX #10: Publish event riêng cho các claim bị auto-reject khi có 1 claim khác được duyệt
    // để notification-service gửi "Claim của bạn bị từ chối" cho từng người
    if (claim.status === 'APPROVED') {
      const autoRejected = item.claims.filter(
        (c) => c._id.toString() !== claim._id.toString() && c.ownerNote === 'Another claim was approved'
      );
      for (const rejected of autoRejected) {
        if (rejected.claimantId) {
          publishLostFoundEvent('lostfound.claim.resolved', {
            id: rejected._id?.toString(),
            claimId: rejected._id?.toString(),
            itemId: item._id.toString(),
            ownerId: item.userId.toString(),
            claimantId: rejected.claimantId.toString(),
            status: 'REJECTED',
            title: item.title,
          }).catch((err) => logger.warn(`Failed to publish auto-reject event: ${err.message}`));
        }
      }
    }

    const profile = await fetchUserProfile(item.userId?.toString());
    res.json(ApiResponse.ok(mapItem(item, profile), 'Claim reviewed'));
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

    // Batch lấy profiles cho source item + tất cả match items
    const allUserIds = [item.userId?.toString(), ...matches.map((m) => m.item.userId?.toString())];
    const profiles = await fetchUserProfiles(allUserIds);

    res.json(
      ApiResponse.ok({
        sourceItem: mapItem(item, profiles[item.userId?.toString()]),
        matches: matches.map((m) => ({
          item: mapItem(m.item, profiles[m.item.userId?.toString()]),
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
 * GET /api/v1/lost-found/admin/heatmap
 * Returns aggregated location data for admin heatmap visualization.
 * Groups items by location and counts LOST vs FOUND.
 */
export async function getHeatmapData(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);

    // BUG FIX #7: Cache kết quả heatmap 5 phút.
    // 3 aggregation pipeline chạy song song rất nặng — không nên chạy lại mỗi request.
    const cacheKey = `lostfound:heatmap:days${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug(`[Cache HIT] ${cacheKey}`);
      return res.json(cached);
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            location: { $ifNull: ['$location', 'Unknown'] },
            type: '$type',
          },
          count: { $sum: 1 },
          items: {
            $push: {
              id: '$_id',
              title: '$title',
              status: '$status',
              createdAt: '$createdAt',
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.location',
          lost: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'LOST'] }, '$count', 0],
            },
          },
          found: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'FOUND'] }, '$count', 0],
            },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          location: '$_id',
          lost: 1,
          found: 1,
          total: 1,
        },
      },
    ];

    // Time-series data: items per day
    const timePipeline = [
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          lost: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'LOST'] }, '$count', 0],
            },
          },
          found: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'FOUND'] }, '$count', 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          lost: 1,
          found: 1,
        },
      },
    ];

    // Analysis stats
    const analysisPipeline = [
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$analysisStatus',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: '$_id',
          count: 1,
        },
      },
    ];

    const [locationData, timeData, analysisData] = await Promise.all([
      LostFoundItem.aggregate(pipeline),
      LostFoundItem.aggregate(timePipeline),
      LostFoundItem.aggregate(analysisPipeline),
    ]);

    const response = ApiResponse.ok({
      locations: locationData,
      timeline: timeData,
      analysisStats: analysisData,
      period: { days, since: since.toISOString() },
    });
    await cache.set(cacheKey, response, 300); // TTL 5 phút
    res.json(response);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/lost-found/admin/bulk-moderate
 * Batch approve/reject/delete multiple lost-found items.
 * Body: { ids: string[], action: 'DELETE' | 'CLOSE' | 'REOPEN' }
 */
export async function bulkModerate(req, res, next) {
  try {
    const { ids, action } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array');
    }
    if (ids.length > 50) {
      throw new BadRequestException('Maximum 50 items per batch');
    }
    if (!['DELETE', 'CLOSE', 'REOPEN'].includes(action)) {
      throw new BadRequestException('action must be DELETE, CLOSE, or REOPEN');
    }

    const items = await LostFoundItem.find({ _id: { $in: ids } });

    if (action === 'DELETE') {
      // Clean up S3 images before deleting
      const deletePromises = items.flatMap((item) =>
        (item.images || []).map((url) => deleteFileByUrl(url)),
      );
      await Promise.allSettled(deletePromises);
      await LostFoundItem.deleteMany({ _id: { $in: ids } });
    } else if (action === 'CLOSE') {
      await LostFoundItem.updateMany(
        { _id: { $in: ids }, status: { $ne: 'CLOSED' } },
        { $set: { status: 'CLOSED' } },
      );
    } else if (action === 'REOPEN') {
      await LostFoundItem.updateMany(
        { _id: { $in: ids }, status: { $in: ['CLOSED', 'RESOLVED'] } },
        { $set: { status: 'OPEN' } },
      );
    }

    // BUG FIX #6: Evict cả item detail cache cho từng ID, không chỉ list cache.
    // Khi admin bulk-delete 50 items, mỗi item có cache detail riêng.
    await Promise.all([
      evictListCache(),
      ...ids.map((id) => evictItemCache(id)),
    ]);

    logger.info(`Bulk ${action}: ${items.length} items by admin ${req.user.sub}`);
    res.json(
      ApiResponse.ok({
        processed: items.length,
        action,
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
      // BUG FIX #9: Dùng calculateMatchScore import từ matching.service.js
      // thay vì hàm calculateMatchScoreFromData duplicate 60 dòng bên dưới.
      const score = calculateMatchScore(data, candidate);
      if (score >= 0.15) {
        scored.push({ item: candidate, score: Math.round(score * 1000) / 1000 });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 10);

    // Batch lấy profiles cho match items
    const userIds = topMatches.map((m) => m.item.userId?.toString());
    const profiles = await fetchUserProfiles(userIds);

    res.json(
      ApiResponse.ok({
        matches: topMatches.map((m) => ({
          item: mapItem(m.item, profiles[m.item.userId?.toString()]),
          score: m.score,
        })),
        totalMatches: topMatches.length,
      }),
    );
  } catch (err) {
    next(err);
  }
}

