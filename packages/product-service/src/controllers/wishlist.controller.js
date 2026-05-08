import { Wishlist } from '../models/Wishlist.js';
import { Product } from '../models/Product.js';
import {
  ApiResponse,
  PageResponse,
  BadRequestException,
  ResourceNotFoundException,
  parsePagination,
  logger,
} from '@iuh-exchange/common';

/**
 * POST /api/v1/products/:productId/wishlist
 * Toggle wishlist for a product (add if not exists, remove if exists).
 */
export async function toggleWishlist(req, res) {
  const { productId } = req.params;
  const userId = req.user.sub;

  // Check product exists
  const product = await Product.findById(productId).lean();
  if (!product) throw new ResourceNotFoundException('Product', productId);

  const existing = await Wishlist.findOne({ userId, productId });

  if (existing) {
    await Wishlist.deleteOne({ _id: existing._id });
    logger.info(`Wishlist removed: user=${userId}, product=${productId}`);
    res.json(ApiResponse.ok({ wishlisted: false }, 'Đã bỏ yêu thích'));
  } else {
    await Wishlist.create({ userId, productId });
    logger.info(`Wishlist added: user=${userId}, product=${productId}`);
    res.json(ApiResponse.ok({ wishlisted: true }, 'Đã thêm vào yêu thích'));
  }
}

/**
 * GET /api/v1/products/:productId/wishlist/check
 * Check if product is in user's wishlist.
 */
export async function checkWishlist(req, res) {
  const { productId } = req.params;
  const userId = req.user.sub;

  const existing = await Wishlist.findOne({ userId, productId }).lean();
  res.json(ApiResponse.ok({ wishlisted: !!existing }));
}

/**
 * GET /api/v1/users/me/wishlist
 * Get user's wishlist with product details.
 */
export async function getMyWishlist(req, res) {
  const userId = req.user.sub;
  const { page, size, skip } = parsePagination(req.query);

  const [items, total] = await Promise.all([
    Wishlist.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .lean(),
    Wishlist.countDocuments({ userId }),
  ]);

  // Fetch product details for each wishlist item
  const productIds = items.map(i => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map(p => [p._id.toString(), p]));

  const content = items
    .map(item => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return {
        id: item._id,
        productId: item.productId,
        product: {
          id: product._id,
          title: product.title,
          price: product.price,
          imageUrls: product.imageUrls || [],
          category: product.category,
          condition: product.condition,
          status: product.status,
          sellerId: product.sellerId,
        },
        addedAt: item.createdAt,
      };
    })
    .filter(Boolean);

  const pageResponse = new PageResponse({
    content,
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  });

  res.json(ApiResponse.ok(pageResponse));
}
