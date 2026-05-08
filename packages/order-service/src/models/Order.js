import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    buyerId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      // NOTE: PENDING here means "buyer placed an order, awaiting product reservation"
      // This is different from Product.status PENDING which means "awaiting admin approval"
      // See also: AWAITING_SELLER (formerly CONFIRMED) = product reserved, waiting for seller
      enum: ['PENDING', 'AWAITING_SELLER', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    buyerNote: { type: String, default: '' },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['VNPAY_MOCK', 'CASH', 'NONE'],
      default: 'NONE',
    },
    paymentTransactionId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Composite unique: prevent duplicate pending orders for same buyer+product.
// This ensures a buyer can only have ONE active PENDING order per product.
// If the previous order was CANCELLED or COMPLETED, a new order is allowed
// (partialFilterExpression only applies to status: 'PENDING').
orderSchema.index(
  { buyerId: 1, productId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

export const Order = mongoose.model('Order', orderSchema);
