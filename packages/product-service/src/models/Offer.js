import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true },
    buyerId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['PRICE', 'TRADE'],
      required: true,
      index: true,
    },
    amount: { type: Number, min: 0, default: null },
    tradeItemTitle: { type: String, trim: true, default: '', maxlength: 200 },
    tradeItemDescription: { type: String, trim: true, default: '', maxlength: 1000 },
    message: { type: String, trim: true, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN'],
      default: 'PENDING',
      index: true,
    },
    counterAmount: { type: Number, min: 0, default: null },
    counterMessage: { type: String, trim: true, default: '', maxlength: 1000 },
    expiresAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
  },
  { timestamps: true }
);

offerSchema.index({ productId: 1, buyerId: 1, status: 1 });

export const Offer = mongoose.model('Offer', offerSchema);
