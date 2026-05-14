import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    changedBy: { type: String, default: 'system' },
    actorRole: {
      type: String,
      enum: ['BUYER', 'SELLER', 'ADMIN', 'SYSTEM'],
      default: 'SYSTEM',
    },
    reason: { type: String, default: '' },
    metadata: { type: Object, default: {} },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['PAYMENT_CREATED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'REFUND_CREATED'],
      required: true,
    },
    transactionId: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['VNPAY_MOCK', 'CASH', 'NONE'],
      default: 'NONE',
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    handoverLocation: { type: String, default: '' },
    handoverTime: { type: Date, default: null },
    disputeStatus: {
      type: String,
      enum: ['NONE', 'OPEN', 'RESOLVED', 'REJECTED'],
      default: 'NONE',
      index: true,
    },
    disputeReason: { type: String, default: '' },
    disputeOpenedBy: { type: String, default: null },
    disputeOpenedAt: { type: Date, default: null },
    disputeResolvedBy: { type: String, default: null },
    disputeResolvedAt: { type: Date, default: null },
    disputeResolution: { type: String, default: '' },
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
    paymentProviderStatus: { type: String, default: 'MOCK_PENDING' },
    paymentWebhookVerified: { type: Boolean, default: false },
    reconciliationStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'MATCHED', 'MISMATCHED'],
      default: 'NOT_REQUIRED',
      index: true,
    },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    receiptNumber: { type: String, unique: true, sparse: true, index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    transactions: { type: [transactionSchema], default: [] },
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
