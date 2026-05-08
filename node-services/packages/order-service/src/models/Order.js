import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  idempotencyKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

// Composite unique: prevent duplicate pending orders
orderSchema.index({ buyerId: 1, productId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });

export const Order = mongoose.model('Order', orderSchema);
