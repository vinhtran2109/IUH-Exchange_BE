import { Product } from '../models/Product.js';
import { containsProfanity } from '../services/profanity-filter.js';
import { generatePresignedUploadUrl, deleteFileByUrl } from '../services/s3.service.js';
import { publishProductEvent, TOPICS } from '../services/kafka.service.js';
import { searchProducts } from '../services/elasticsearch.service.js';
import {
  ApiResponse,
  PageResponse,
  BadRequestException,
  ResourceNotFoundException,
  ForbiddenException,
  logger,
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
  const { page, size, sort, category } = req.query;
  const skip = (page - 1) * size;

  const filter = { status: 'AVAILABLE' };
  if (category) filter.category = category;

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

  res.json(ApiResponse.ok(pageResponse, 'Success'));
}

/**
 * GET /api/v1/products/search?keyword=xxx
 * Fuzzy search via ElasticSearch.
 */
export async function searchProductsHandler(req, res) {
  const { keyword, page, size } = req.query;
  const result = await searchProducts(keyword, page, size);

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
 * GET /api/v1/products/me
 * List products belonging to the authenticated seller.
 */
export async function getMyProducts(req, res) {
  const sellerId = req.user.sub;
  const { page, size } = req.query;
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
  const product = await Product.findById(req.params.id).lean();
  if (!product) throw new ResourceNotFoundException('Product', req.params.id);
  res.json(ApiResponse.ok(toResponse(product), 'Success'));
}

/**
 * POST /api/v1/products
 * Create a new product (authenticated).
 */
export async function createProduct(req, res) {
  const sellerId = req.user.sub;
  const { title, description, price, category, condition, imageUrls } = req.body;

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
    condition,
    imageUrls: imageUrls || [],
    status: 'PENDING_APPROVAL',
  });

  logger.info(`Product created: id=${product._id}, title=${title}`);

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

  const { title, description, price, imageUrls } = req.body;

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
  if (imageUrls !== undefined) product.imageUrls = imageUrls;

  const saved = await product.save();

  // Publish update event to Kafka for ElasticSearch sync
  await publishProductEvent(TOPICS.PRODUCT_UPDATED, {
    id: saved._id.toString(),
    title: saved.title,
    description: saved.description,
    price: saved.price,
    category: saved.category,
    status: saved.status,
  });

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

  logger.info(`Product deleted: id=${product._id}`);
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
  const { page, size } = req.query;
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
 * PATCH /api/v1/products/admin/:id/resolve
 * Approve or reject a product (admin only).
 */
export async function resolveProduct(req, res) {
  const { action } = req.body;
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
      status: saved.status,
    });
  }

  logger.info(`Product ${action}: id=${saved._id}`);
  res.json(ApiResponse.ok(toResponse(saved), 'Resolved successfully'));
}

/**
 * GET /api/v1/products/admin/stats
 * Dashboard statistics (admin only).
 */
export async function getProductStats(_req, res) {
  const [total, pending, available, sold] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ status: 'PENDING_APPROVAL' }),
    Product.countDocuments({ status: 'AVAILABLE' }),
    Product.countDocuments({ status: 'SOLD' }),
  ]);

  res.json(ApiResponse.ok({ total, pending, available, sold }));
}
