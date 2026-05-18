import {
  ApiResponse,
  BadRequestException,
  ForbiddenException,
  ResourceNotFoundException,
  parsePagination,
  PageResponse,
} from '@iuh-exchange/common';
import { Offer } from '../models/Offer.js';
import { Product } from '../models/Product.js';
import { publishProductEvent } from '../services/kafka.service.js';

const DEFAULT_OFFER_TTL_HOURS = 48;

function mapOffer(offer) {
  const obj = offer.toObject ? offer.toObject() : offer;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
  };
}

function buildExpiresAt(hours = DEFAULT_OFFER_TTL_HOURS) {
  return new Date(Date.now() + Math.max(1, Number(hours) || DEFAULT_OFFER_TTL_HOURS) * 60 * 60 * 1000);
}

async function expireOfferIfNeeded(offer) {
  if (offer.status === 'PENDING' && offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) {
    offer.status = 'EXPIRED';
    offer.resolvedAt = new Date();
    offer.resolvedBy = 'system';
    await offer.save();
  }
  return offer;
}

export async function createOffer(req, res) {
  const buyerId = req.user.sub;
  const { productId } = req.params;
  const product = await Product.findById(productId);
  if (!product) throw new ResourceNotFoundException('Product', productId);
  if (String(product.sellerId) === String(buyerId)) throw new BadRequestException('You cannot offer on your own product');
  if (product.status !== 'AVAILABLE') throw new BadRequestException('Product is not available for offers');
  if (product.allowOffers === false) throw new BadRequestException('Seller is not accepting offers for this product');

  const type = req.body?.type === 'TRADE' ? 'TRADE' : 'PRICE';
  const amount = req.body?.amount;
  const tradeItemTitle = String(req.body?.tradeItemTitle || '').trim();
  const tradeItemDescription = String(req.body?.tradeItemDescription || '').trim();

  if (type === 'PRICE' && (typeof amount !== 'number' || amount < 0)) {
    throw new BadRequestException('A price offer requires a non-negative amount');
  }
  if (type === 'TRADE' && !tradeItemTitle) {
    throw new BadRequestException('A trade offer requires tradeItemTitle');
  }

  await Offer.updateMany(
    { productId, buyerId, status: 'PENDING' },
    { status: 'WITHDRAWN', resolvedAt: new Date(), resolvedBy: buyerId }
  );

  const offer = await Offer.create({
    productId,
    buyerId,
    sellerId: product.sellerId,
    type,
    amount: type === 'PRICE' ? amount : null,
    tradeItemTitle,
    tradeItemDescription,
    message: String(req.body?.message || '').trim(),
    expiresAt: buildExpiresAt(req.body?.expiresInHours),
  });

  await publishProductEvent('offer.created', {
    id: offer._id.toString(),
    offerId: offer._id.toString(),
    productId,
    buyerId,
    sellerId: product.sellerId,
    type,
    amount: offer.amount,
  });

  res.status(201).json(ApiResponse.created(mapOffer(offer)));
}

export async function listProductOffers(req, res) {
  const userId = req.user.sub;
  const { productId } = req.params;
  const product = await Product.findById(productId).lean();
  if (!product) throw new ResourceNotFoundException('Product', productId);
  if (String(product.sellerId) !== String(userId)) {
    throw new ForbiddenException('Only the seller can view all offers for this product');
  }

  const { page, size, skip } = parsePagination(req.query);
  const [offers, total] = await Promise.all([
    Offer.find({ productId }).sort({ createdAt: -1 }).skip(skip).limit(size),
    Offer.countDocuments({ productId }),
  ]);

  await Promise.all(offers.map(expireOfferIfNeeded));

  res.json(ApiResponse.ok(new PageResponse({
    content: offers.map(mapOffer),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  })));
}

export async function listMyOffers(req, res) {
  const userId = req.user.sub;
  const { page, size, skip } = parsePagination(req.query);
  const [offers, total] = await Promise.all([
    Offer.find({ buyerId: userId }).sort({ createdAt: -1 }).skip(skip).limit(size),
    Offer.countDocuments({ buyerId: userId }),
  ]);
  await Promise.all(offers.map(expireOfferIfNeeded));

  res.json(ApiResponse.ok(new PageResponse({
    content: offers.map(mapOffer),
    page,
    size,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    last: page * size >= total,
  })));
}

export async function resolveOffer(req, res) {
  const userId = req.user.sub;
  const { offerId } = req.params;
  const offer = await Offer.findById(offerId);
  if (!offer) throw new ResourceNotFoundException('Offer', offerId);
  await expireOfferIfNeeded(offer);
  if (offer.status !== 'PENDING') throw new BadRequestException(`Offer is already ${offer.status.toLowerCase()}`);
  if (String(offer.sellerId) !== String(userId)) throw new ForbiddenException('Only the seller can resolve this offer');

  const action = String(req.body?.action || '').toUpperCase();
  if (!['ACCEPT', 'REJECT', 'COUNTER'].includes(action)) {
    throw new BadRequestException('action must be ACCEPT, REJECT, or COUNTER');
  }

  if (action === 'COUNTER') {
    const counterAmount = req.body?.counterAmount;
    if (typeof counterAmount !== 'number' || counterAmount < 0) {
      throw new BadRequestException('counterAmount must be a non-negative number');
    }
    offer.status = 'COUNTERED';
    offer.counterAmount = counterAmount;
    offer.counterMessage = String(req.body?.counterMessage || '').trim();
  } else {
    offer.status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
  }
  offer.resolvedAt = new Date();
  offer.resolvedBy = userId;
  await offer.save();

  if (offer.status === 'ACCEPTED') {
    await Offer.updateMany(
      { productId: offer.productId, _id: { $ne: offer._id }, status: 'PENDING' },
      { status: 'REJECTED', resolvedAt: new Date(), resolvedBy: userId }
    );
  }

  await publishProductEvent('offer.resolved', {
    id: offer._id.toString(),
    offerId: offer._id.toString(),
    productId: offer.productId,
    buyerId: offer.buyerId,
    sellerId: offer.sellerId,
    status: offer.status,
    type: offer.type,
    amount: offer.amount,
    counterAmount: offer.counterAmount,
  });

  res.json(ApiResponse.ok(mapOffer(offer), 'Offer resolved'));
}

export async function withdrawOffer(req, res) {
  const userId = req.user.sub;
  const { offerId } = req.params;
  const offer = await Offer.findById(offerId);
  if (!offer) throw new ResourceNotFoundException('Offer', offerId);
  if (String(offer.buyerId) !== String(userId)) throw new ForbiddenException('Only the buyer can withdraw this offer');
  if (offer.status !== 'PENDING') throw new BadRequestException(`Offer is already ${offer.status.toLowerCase()}`);
  offer.status = 'WITHDRAWN';
  offer.resolvedAt = new Date();
  offer.resolvedBy = userId;
  await offer.save();
  res.json(ApiResponse.ok(mapOffer(offer), 'Offer withdrawn'));
}

export async function getOfferCheckout(req, res) {
  const buyerId = req.user.sub;
  const { offerId } = req.params;
  const offer = await Offer.findById(offerId).lean();
  if (!offer) throw new ResourceNotFoundException('Offer', offerId);
  if (String(offer.buyerId) !== String(buyerId)) throw new ForbiddenException('Offer does not belong to this buyer');
  if (offer.status !== 'ACCEPTED') throw new BadRequestException('Only accepted offers can be converted into orders');

  const product = await Product.findById(offer.productId).lean();
  if (!product) throw new ResourceNotFoundException('Product', offer.productId);
  if (product.status !== 'AVAILABLE') throw new BadRequestException('Product is no longer available');

  res.json(ApiResponse.ok({
    offerId: offer._id.toString(),
    productId: offer.productId,
    sellerId: offer.sellerId,
    buyerId: offer.buyerId,
    price: offer.type === 'PRICE' ? offer.amount : 0,
    listingType: offer.type === 'TRADE' ? 'TRADE' : (product.listingType || 'SELL'),
    tradeItemTitle: offer.tradeItemTitle || '',
    tradeItemDescription: offer.tradeItemDescription || '',
  }));
}
