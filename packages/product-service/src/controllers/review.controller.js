import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';
import {
  ApiResponse,
  PageResponse,
  BadRequestException,
  ResourceNotFoundException,
  ForbiddenException,
  parsePagination,
  logger,
} from '@iuh-exchange/common';

/**
 * POST /api/v1/products/:productId/reviews
 * Create a review for a product (buyer only, after order completed).
 */
export async function createReview(req, res) {
  const { productId } = req.params;
  const buyerId = req.user.sub;
  const { rating, comment, orderId } = req.body;

  if (!orderId) throw new BadRequestException('orderId is required');
  if (!rating || rating < 1 || rating > 5) throw new BadRequestException('Rating must be between 1 and 5');

  // Check product exists
  const product = await Product.findById(productId).lean();
  if (!product) throw new ResourceNotFoundException('Product', productId);

  // Prevent self-review
  if (product.sellerId === buyerId) {
    throw new ForbiddenException('You cannot review your own product');
  }

  // Check if already reviewed this order
  const existing = await Review.findOne({ orderId });
  if (existing) {
    throw new BadRequestException('You have already reviewed this order');
  }

  const review = await Review.create({
    productId,
    orderId,
    buyerId,
    sellerId: product.sellerId,
    rating,
    comment: comment || '',
  });

  logger.info(`Review created: product=${productId}, buyer=${buyerId}, rating=${rating}`);

  res.status(201).json(ApiResponse.created({
    id: review._id,
    productId: review.productId,
    orderId: review.orderId,
    buyerId: review.buyerId,
    sellerId: review.sellerId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  }));
}

/**
 * GET /api/v1/products/:productId/reviews
 * Get paginated reviews for a product.
 */
export async function getProductReviews(req, res) {
  const { productId } = req.params;
  const { page, size, skip } = parsePagination(req.query);

  const [reviews, total] = await Promise.all([
    Review.find({ productId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
    Review.countDocuments({ productId }),
  ]);

  // Calculate average rating
  const avgResult = await Review.aggregate([
    { $match: { productId } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
  ]);

  const avgRating = avgResult.length > 0 ? Math.round(avgResult[0].avgRating * 10) / 10 : 0;
  const totalReviews = avgResult.length > 0 ? avgResult[0].totalReviews : 0;

  const pageResponse = new PageResponse({
    content: reviews.map(r => ({
      id: r._id,
      productId: r.productId,
      buyerId: r.buyerId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok({ ...pageResponse, avgRating, totalReviews }));
}

/**
 * GET /api/v1/products/:productId/reviews/check?orderId=xxx
 * Check if buyer has already reviewed this order.
 */
export async function checkReviewExists(req, res) {
  const { productId } = req.params;
  const { orderId } = req.query;
  const buyerId = req.user.sub;

  if (!orderId) throw new BadRequestException('orderId is required');

  const review = await Review.findOne({ orderId, buyerId }).lean();
  res.json(ApiResponse.ok({ exists: !!review, review: review || null }));
}

/**
 * GET /api/v1/users/:userId/reviews
 * Get reviews for a seller (public).
 */
export async function getSellerReviews(req, res) {
  const { userId } = req.params;
  const { page, size, skip } = parsePagination(req.query);

  const [reviews, total] = await Promise.all([
    Review.find({ sellerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
    Review.countDocuments({ sellerId: userId }),
  ]);

  const avgResult = await Review.aggregate([
    { $match: { sellerId: userId } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
  ]);

  const avgRating = avgResult.length > 0 ? Math.round(avgResult[0].avgRating * 10) / 10 : 0;
  const totalReviews = avgResult.length > 0 ? avgResult[0].totalReviews : 0;

  const pageResponse = new PageResponse({
    content: reviews.map(r => ({
      id: r._id,
      productId: r.productId,
      buyerId: r.buyerId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok({ ...pageResponse, avgRating, totalReviews }));
}
