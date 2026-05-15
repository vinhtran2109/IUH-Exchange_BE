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
      enum: ['PAYMENT_CREATED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'REFUND_CREATED', 'TRANSFER_REPORTED', 'TRANSFER_CONFIRMED'],
      required: true,
    },
    transactionId: { type: String, default: null },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['VNPAY_MOCK', 'BANK_TRANSFER', 'CASH', 'NONE'],
      default: 'NONE',
    },
    status: {
      type: String,
      enum: ['PENDING', 'REPORTED', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const meetingProposalSchema = new mongoose.Schema(
  {
    location: { type: String, required: true, trim: true, maxlength: 300 },
    time: { type: Date, required: true },
    note: { type: String, default: '', maxlength: 1000 },
    proposedBy: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'CANCELLED'],
      default: 'PENDING',
    },
    respondedBy: { type: String, default: null },
    respondedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const disputeEvidenceSchema = new mongoose.Schema(
  {
    submittedBy: { type: String, required: true },
    type: {
      type: String,
      enum: ['IMAGE', 'CHAT_SCREENSHOT', 'RECEIPT', 'OTHER'],
      default: 'OTHER',
    },
    url: { type: String, required: true },
    note: { type: String, default: '', maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const disputeTimelineSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['OPENED', 'EVIDENCE_ADDED', 'ADMIN_NOTE', 'RESOLVED', 'REJECTED'],
      required: true,
    },
    actorId: { type: String, required: true },
    actorRole: {
      type: String,
      enum: ['BUYER', 'SELLER', 'ADMIN', 'SYSTEM'],
      default: 'SYSTEM',
    },
    note: { type: String, default: '', maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
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
    handoverStatus: {
      type: String,
      enum: ['NOT_SCHEDULED', 'PROPOSED', 'SCHEDULED', 'BUYER_CONFIRMED', 'SELLER_CONFIRMED', 'HANDED_OVER', 'CANCELLED'],
      default: 'NOT_SCHEDULED',
      index: true,
    },
    meetingProposals: { type: [meetingProposalSchema], default: [] },
    buyerHandoverConfirmedAt: { type: Date, default: null },
    sellerHandoverConfirmedAt: { type: Date, default: null },
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
    disputeEvidence: { type: [disputeEvidenceSchema], default: [] },
    disputeTimeline: { type: [disputeTimelineSchema], default: [] },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['VNPAY_MOCK', 'BANK_TRANSFER', 'CASH', 'NONE'],
      default: 'NONE',
    },
    paymentTransactionId: { type: String, default: null },
    transferProofUrl: { type: String, default: '' },
    transferReportedAt: { type: Date, default: null },
    transferConfirmedAt: { type: Date, default: null },
    transferConfirmedBy: { type: String, default: null },
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
