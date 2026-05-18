import { ApiResponse, PageResponse, BadRequestException, parsePagination } from '@iuh-exchange/common';
import { Product } from '../models/Product.js';
import { ProductView } from '../models/ProductView.js';
import { Review } from '../models/Review.js';
import { SellerFollow } from '../models/SellerFollow.js';

function productSummary(product) {
  return {
    id: product._id,
    title: product.title,
    price: product.price,
    imageUrls: product.imageUrls || [],
    category: product.category,
    condition: product.condition,
    location: product.location || '',
    status: product.status,
    sellerId: product.sellerId,
    createdAt: product.createdAt,
  };
}

export async function toggleSellerFollow(req, res) {
  const followerId = req.user.sub;
  const { sellerId } = req.params;

  if (String(followerId) === String(sellerId)) {
    throw new BadRequestException('Bạn không thể theo dõi chính mình');
  }

  const existing = await SellerFollow.findOne({ followerId, sellerId });
  if (existing) {
    await SellerFollow.deleteOne({ _id: existing._id });
    return res.json(ApiResponse.ok({ following: false }, 'Đã bỏ theo dõi'));
  }

  await SellerFollow.create({ followerId, sellerId });
  return res.json(ApiResponse.ok({ following: true }, 'Đã theo dõi người bán'));
}

export async function checkSellerFollow(req, res) {
  const followerId = req.user.sub;
  const { sellerId } = req.params;
  const existing = await SellerFollow.findOne({ followerId, sellerId }).lean();
  res.json(ApiResponse.ok({ following: !!existing }));
}

export async function recordProductView(req, res) {
  const userId = req.user.sub;
  const { productId } = req.params;
  const product = await Product.findById(productId).lean();
  if (!product) return res.status(404).json(ApiResponse.error(404, 'Product not found'));

  await ProductView.findOneAndUpdate(
    { userId, productId },
    { userId, productId, sellerId: product.sellerId, viewedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json(ApiResponse.ok({ viewed: true }));
}

export async function getMyViewHistory(req, res) {
  const userId = req.user.sub;
  const { page, size, skip } = parsePagination(req.query);

  const [views, total] = await Promise.all([
    ProductView.find({ userId }).sort({ viewedAt: -1 }).skip(skip).limit(size).lean(),
    ProductView.countDocuments({ userId }),
  ]);

  const productIds = views.map((view) => view.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  const content = views
    .map((view) => {
      const product = productMap.get(view.productId);
      if (!product) return null;
      return {
        id: view._id,
        productId: view.productId,
        viewedAt: view.viewedAt,
        product: productSummary(product),
      };
    })
    .filter(Boolean);

  res.json(ApiResponse.ok(new PageResponse({
    content,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  })));
}

export async function getSellerTrustProfile(req, res) {
  const { sellerId } = req.params;

  const [ratingAgg, soldCount, activeCount, followerCount, recentReviews, recentProducts] = await Promise.all([
    Review.aggregate([
      { $match: { sellerId } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
    ]),
    Product.countDocuments({ sellerId, status: 'SOLD' }),
    Product.countDocuments({ sellerId, status: 'AVAILABLE' }),
    SellerFollow.countDocuments({ sellerId }),
    Review.find({ sellerId }).sort({ createdAt: -1 }).limit(5).lean(),
    Product.find({ sellerId, status: { $in: ['AVAILABLE', 'SOLD'] } }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const avgRating = ratingAgg.length > 0 ? Math.round(ratingAgg[0].avgRating * 10) / 10 : 0;
  const totalReviews = ratingAgg[0]?.totalReviews || 0;
  const trustScore = Math.min(100, Math.round(avgRating * 16 + Math.min(totalReviews, 20) + Math.min(soldCount, 20)));

  res.json(ApiResponse.ok({
    sellerId,
    avgRating,
    totalReviews,
    soldCount,
    activeCount,
    followerCount,
    trustScore,
    badge:
      trustScore >= 85 ? 'Uy tín cao' :
      trustScore >= 65 ? 'Uy tín tốt' :
      totalReviews > 0 ? 'Đang xây dựng uy tín' : 'Người bán mới',
    recentReviews: recentReviews.map((review) => ({
      id: review._id,
      productId: review.productId,
      buyerId: review.buyerId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    })),
    recentProducts: recentProducts.map(productSummary),
  }));
}
