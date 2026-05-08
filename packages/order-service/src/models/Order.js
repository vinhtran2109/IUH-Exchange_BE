import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    buyerId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'AWAITING_SELLER', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    buyerNote: { type: String, default: '' },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
  },
  { timestamps: true }
);

// Composite unique: prevent duplicate pending orders for same buyer+product
orderSchema.index(
  { buyerId: 1, productId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

export const Order = mongoose.model('Order', orderSchema);
