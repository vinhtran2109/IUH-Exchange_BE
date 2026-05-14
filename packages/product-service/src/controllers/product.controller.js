import { Product } from '../models/Product.js';
import { containsProfanity } from '../services/profanity-filter.js';
import { generatePresignedUploadUrl, deleteFileByUrl } from '../services/s3.service.js';
import { publishProductEvent, TOPICS } from '../services/kafka.service.js';
import { searchProducts, suggestProducts } from '../services/elasticsearch.service.js';
import {
  ApiResponse,
  PageResponse,
  BadRequestException,
  ResourceNotFoundException,
  ForbiddenException,
  logger,
  cache,
} from '@iuh-exchange/common';

// ── Helpers ──

function toResponse(product) {
  return {
    id: product._id.toString(),
    title: product.title,
    description: product.description,
    price: product.price,
    imageUrls: product.imageUrls || [],
    category: product.category,
    location: product.location || '',
    condition: product.condition,
    status: product.status,
    sellerId: product.sellerId,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function buildSortOption(sortParam) {
  if (!sortParam) return { createdAt: -1 };
  const sort = {};
  for (const part of sortParam.split(',')) {
    const [field, order] = part.trim().split(':');
    sort[field] = order === 'asc' ? 1 : -1;
  }
  return sort;
}

// ── Controllers ──

/**
 * GET /api/v1/products
 * List available products with pagination, sort, and optional category filter.
 */
export async function listProducts(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));
  const sort = req.query.sort;
  const category = req.query.category;
  const location = req.query.location;
  const skip = (page - 1) * size;

  // Build cache key from query params
  const cacheKey = `products:list:${page}:${size}:${sort || 'default'}:${category || 'all'}:${location || 'all'}`;
  
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const filter = { status: 'AVAILABLE' };
  if (category) filter.category = category;
  if (location) filter.location = { $regex: location, $options: 'i' };

  const [products, total] = await Promise.all([
    Product.find(filter).sort(buildSortOption(sort)).skip(skip).limit(size).lean(),
    Product.countDocuments(filter),
  ]);

  const pageResponse = new PageResponse({
    content: products.map(toResponse),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  const response = ApiResponse.ok(pageResponse, 'Success');
  await cache.set(cacheKey, response, 120); // Cache 2 minutes
  res.json(response);
}

/**
 * GET /api/v1/products/search?keyword=xxx
 * Fuzzy search via ElasticSearch with optional filters.
 */
export async function searchProductsHandler(req, res) {
  const keyword = req.query.keyword || '';
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));

  const filters = {};
  if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice);
  if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice);
  if (req.query.category) filters.category = req.query.category;
  if (req.query.condition) filters.condition = req.query.condition;
  if (req.query.location) filters.location = req.query.location;
  if (req.query.sort) filters.sort = req.query.sort;

  const result = await searchProducts(keyword, page, size, filters);

  const pageResponse = new PageResponse({
    content: result.hits,
    page,
    size,
    totalElements: result.total,
    totalPages: Math.ceil(result.total / size),
    last: page * size >= result.total,
  });

  res.json(ApiResponse.ok(pageResponse, 'Search results'));
}

/**
 * GET /api/v1/products/suggestions?keyword=xxx
 * Autocomplete search suggestions.
 */
export async function suggestProductsHandler(req, res) {
  const keyword = String(req.query.keyword || '').trim();
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '8', 10)));
  const suggestions = await suggestProducts(keyword, limit);
  res.json(ApiResponse.ok(suggestions, 'Search suggestions'));
}

/**
 * GET /api/v1/products/me
 * List products belonging to the authenticated seller.
 */
export async function getMyProducts(req, res) {
  const sellerId = req.user.sub;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));
  const skip = (page - 1) * size;

  const [products, total] = await Promise.all([
    Product.find({ sellerId }).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
    Product.countDocuments({ sellerId }),
  ]);

  const pageResponse = new PageResponse({
    content: products.map(toResponse),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse));
}

/**
 * GET /api/v1/products/:id
 * Get a single product by ID.
 */
export async function getProductById(req, res) {
  const cacheKey = `products:detail:${req.params.id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new ResourceNotFoundException('Product', req.params.id);

  const response = ApiResponse.ok(toResponse(product), 'Success');
  await cache.set(cacheKey, response, 300); // Cache 5 minutes
  res.json(response);
}

/**
 * POST /api/v1/products
 * Create a new product (authenticated).
 */
export async function createProduct(req, res) {
  const sellerId = req.user.sub;
  const { title, description, price, category, location, condition, imageUrls } = req.body;

  // Profanity filter
  if (containsProfanity(title) || containsProfanity(description)) {
    throw new BadRequestException('Nội dung chứa từ ngữ không phù hợp với môi trường học đường.');
  }

  const product = await Product.create({
    sellerId,
    title,
    description,
    price,
    category,
    location: location || '',
    condition,
    imageUrls: imageUrls || [],
    status: 'PENDING_APPROVAL',
  });

  logger.info(`Product created: id=${product._id}, title=${title}`);

  // Invalidate product list cache
  await cache.delPattern('products:list:*');
  await cache.del('products:admin:stats');

  res.status(201).json(ApiResponse.created(toResponse(product)));
}

/**
 * PUT /api/v1/products/:id
 * Update a product (authenticated, owner only).
 */
export async function updateProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ResourceNotFoundException('Product', req.params.id);

  if (product.sellerId !== req.user.sub) {
    throw new ForbiddenException("You don't have permission to update this product");
  }

  const { title, description, price, category, condition, location, imageUrls } = req.body;

  // Profanity filter on updated text
  if (title && containsProfanity(title)) {
    throw new BadRequestException('Nội dung chứa từ ngữ không phù hợp với môi trường học đường.');
  }
  if (description && containsProfanity(description)) {
    throw new BadRequestException('Nội dung chứa từ ngữ không phù hợp với môi trường học đường.');
  }

  if (title !== undefined) product.title = title;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (category !== undefined) product.category = category;
  if (condition !== undefined) product.condition = condition;
  if (location !== undefined) product.location = location;
  if (imageUrls !== undefined) product.imageUrls = imageUrls;

  const saved = await product.save();

  // Publish update event to Kafka for ElasticSearch sync
  await publishProductEvent(TOPICS.PRODUCT_UPDATED, {
    id: saved._id.toString(),
    title: saved.title,
    description: saved.description,
    price: saved.price,
    category: saved.category,
    location: saved.location || '',
    condition: saved.condition,
    status: saved.status,
    createdAt: saved.createdAt,
  });

  // Invalidate cache
  await cache.del(`products:detail:${saved._id}`);
  await cache.delPattern('products:list:*');
  await cache.del('products:admin:stats');

  res.json(ApiResponse.ok(toResponse(saved), 'Updated successfully'));
}

/**
 * DELETE /api/v1/products/:id
 * Delete a product (authenticated, owner only). Hard delete + S3 cleanup.
 */
export async function deleteProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ResourceNotFoundException('Product', req.params.id);

  if (product.sellerId !== req.user.sub) {
    throw new ForbiddenException("You don't have permission to delete this product");
  }

  // Clean up S3 images
  if (product.imageUrls?.length) {
    await Promise.all(product.imageUrls.map((url) => deleteFileByUrl(url)));
  }

  await Product.findByIdAndDelete(req.params.id);

  // Publish delete event for ElasticSearch cleanup
  await publishProductEvent(TOPICS.PRODUCT_DELETED, { id: product._id.toString() });

  // Invalidate cache
  await cache.del(`products:detail:${product._id}`);
  await cache.delPattern('products:list:*');
  await cache.del('products:admin:stats');

  logger.info(`Product deleted: id=${product._id}`);
  res.json(ApiResponse.ok(null, 'Deleted successfully'));
}

/**
 * DELETE /api/v1/products/admin/:id
 * Delete a product as admin.
 */
export async function deleteProductAsAdmin(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ResourceNotFoundException('Product', req.params.id);

  if (product.imageUrls?.length) {
    await Promise.all(product.imageUrls.map((url) => deleteFileByUrl(url)));
  }

  await Product.findByIdAndDelete(req.params.id);
  await publishProductEvent(TOPICS.PRODUCT_DELETED, { id: product._id.toString() });

  await cache.del(`products:detail:${product._id}`);
  await cache.delPattern('products:list:*');
  await cache.del('products:admin:stats');

  logger.info(`[Admin] Product deleted: id=${product._id}`);
  res.json(ApiResponse.ok(null, 'Deleted successfully'));
}

/**
 * POST /api/v1/products/upload-url
 * Get a presigned S3 URL for direct image upload.
 */
export async function getUploadUrl(req, res) {
  const { filename, contentType } = req.body;
  const { presignedUrl, publicUrl } = await generatePresignedUploadUrl(filename, contentType);

  res.json(ApiResponse.ok({ presignedUrl, publicUrl }, 'Upload URL generated successfully'));
}

// ── Admin Endpoints ──

/**
 * GET /api/v1/products/admin/pending
 * List products pending approval (admin only).
 */
export async function getPendingProducts(req, res) {
  logger.info(`getPendingProducts called by: user=${req.user?.sub}, role=${req.user?.role}`);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));
  const skip = (page - 1) * size;

  const [products, total] = await Promise.all([
    Product.find({ status: 'PENDING_APPROVAL' }).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
    Product.countDocuments({ status: 'PENDING_APPROVAL' }),
  ]);

  const pageResponse = new PageResponse({
    content: products.map(toResponse),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse, 'Success'));
}

/**
 * GET /api/v1/products/admin
 * List products for admin moderation with optional status filter.
 */
export async function listAdminProducts(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || '20', 10)));
  const skip = (page - 1) * size;
  const { status } = req.query;

  const filter = {};
  if (status && status !== 'ALL') {
    filter.status = status;
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
    Product.countDocuments(filter),
  ]);

  const pageResponse = new PageResponse({
    content: products.map(toResponse),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse, 'Success'));
}

/**
 * PATCH /api/v1/products/admin/:id/resolve
 * Approve or reject a product (admin only).
 */
export async function resolveProduct(req, res) {
  const action = req.query.action || req.body?.action;
  const product = await Product.findById(req.params.id);
  if (!product) throw new ResourceNotFoundException('Product', req.params.id);

  if (action === 'APPROVE') {
    product.status = 'AVAILABLE';
  } else if (action === 'REJECT') {
    product.status = 'REJECTED';
  } else {
    throw new BadRequestException(`Invalid action: ${action}`);
  }

  const saved = await product.save();

  // If approved, publish to Kafka so ElasticSearch indexes it
  if (saved.status === 'AVAILABLE') {
    await publishProductEvent(TOPICS.PRODUCT_CREATED, {
      id: saved._id.toString(),
      title: saved.title,
      description: saved.description,
      price: saved.price,
      category: saved.category,
      location: saved.location || '',
      condition: saved.condition,
      status: saved.status,
      createdAt: saved.createdAt,
    });

    // Notify seller: product approved
    await publishProductEvent('product.approved', {
      sellerId: saved.sellerId,
      productId: saved._id.toString(),
      productTitle: saved.title,
    });
  }

  // If rejected, notify seller
  if (saved.status === 'REJECTED') {
    await publishProductEvent('product.rejected', {
      sellerId: saved.sellerId,
      productId: saved._id.toString(),
      productTitle: saved.title,
      reason: req.body?.reason || '',
    });
  }

  logger.info(`Product ${action}: id=${saved._id}`);

  // Invalidate cache
  await cache.del(`products:detail:${saved._id}`);
  await cache.delPattern('products:list:*');
  await cache.del('products:admin:stats');

  res.json(ApiResponse.ok(toResponse(saved), 'Resolved successfully'));
}

/**
 * GET /api/v1/products/admin/stats
 * Dashboard statistics (admin only).
 */
export async function getProductStats(_req, res) {
  const cacheKey = 'products:admin:stats';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const [total, pending, available, sold] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ status: 'PENDING_APPROVAL' }),
    Product.countDocuments({ status: 'AVAILABLE' }),
    Product.countDocuments({ status: 'SOLD' }),
  ]);

  const response = ApiResponse.ok({ total, pending, available, sold });
  await cache.set(cacheKey, response, 30); // Cache 30 seconds
  res.json(response);
}
